import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import type * as ConfigModule from "../../src/config";
import { SwapType } from "../../src/consts/Enums";
import type * as BoltzClientModule from "../../src/utils/boltzClient";
import type * as FiatModule from "../../src/utils/fiat";

const { getBtcPriceFailoverMock, getPairsMock, configMock } = vi.hoisted(
    () => ({
        getBtcPriceFailoverMock: vi.fn<typeof FiatModule.getBtcPriceFailover>(),
        getPairsMock: vi.fn<typeof BoltzClientModule.getPairs>(),
        configMock: { isPro: false } as { isPro: boolean },
    }),
);

vi.mock("../../src/utils/fiat", async () => {
    const actual = await vi.importActual<typeof FiatModule>(
        "../../src/utils/fiat",
    );

    return {
        ...actual,
        getBtcPriceFailover: getBtcPriceFailoverMock,
    };
});

vi.mock("../../src/utils/boltzClient", async () => {
    const actual = await vi.importActual<typeof BoltzClientModule>(
        "../../src/utils/boltzClient",
    );

    return {
        ...actual,
        getPairs: getPairsMock,
    };
});

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: new Proxy(actual.config as object, {
            get(target, prop) {
                if (prop === "isPro") {
                    return configMock.isPro;
                }
                return target[prop as keyof typeof target];
            },
        }),
    };
});

const { GlobalProvider, useGlobalContext } =
    await import("../../src/context/Global");

const emptyPairs = {
    [SwapType.Submarine]: {},
    [SwapType.Reverse]: {},
    [SwapType.Chain]: {},
} as unknown as Awaited<ReturnType<typeof BoltzClientModule.getPairs>>;

describe("Global context", () => {
    let globalSignals: ReturnType<typeof useGlobalContext>;

    const Probe = () => {
        globalSignals = useGlobalContext();
        return null;
    };

    beforeEach(() => {
        getBtcPriceFailoverMock.mockReset();
        getPairsMock.mockReset();
        configMock.isPro = false;
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    test("fetchBtcPrice should fetch even when fiat display is disabled", async () => {
        getBtcPriceFailoverMock.mockResolvedValue(BigNumber(123_456));

        render(() => (
            <GlobalProvider>
                <Probe />
            </GlobalProvider>
        ));

        globalSignals.setShowFiatAmount(false);

        await globalSignals.fetchBtcPrice();

        expect(getBtcPriceFailoverMock).toHaveBeenCalledTimes(1);
        expect(globalSignals.btcPrice()?.toString()).toBe("123456");
    });

    test("fetchBtcPrice should reuse a recent successful price", async () => {
        getBtcPriceFailoverMock
            .mockResolvedValueOnce(BigNumber(111_111))
            .mockResolvedValueOnce(BigNumber(222_222));

        render(() => (
            <GlobalProvider>
                <Probe />
            </GlobalProvider>
        ));

        await globalSignals.fetchBtcPrice();
        await globalSignals.fetchBtcPrice();

        expect(getBtcPriceFailoverMock).toHaveBeenCalledTimes(1);
        expect(globalSignals.btcPrice()?.toString()).toBe("111111");
    });

    describe("pair fetching", () => {
        test("fetchRegularPairs uses the regular referral on the pro site", async () => {
            // Regression: previously fetchRegularPairs called getReferral(),
            // which on the pro site returns "pro" — making fetchPairs and
            // fetchRegularPairs return identical data and breaking the
            // FeeComparisonTable opportunity filter.
            configMock.isPro = true;
            getPairsMock.mockResolvedValue(emptyPairs);

            render(() => (
                <GlobalProvider>
                    <Probe />
                </GlobalProvider>
            ));

            await globalSignals.fetchRegularPairs();

            expect(getPairsMock).toHaveBeenCalledTimes(1);
            expect(getPairsMock).toHaveBeenCalledWith({
                headers: { referral: "boltz_webapp_desktop" },
            });
        });

        test("fetchPairs and fetchRegularPairs send different referrals on the pro site", async () => {
            configMock.isPro = true;
            getPairsMock.mockResolvedValue(emptyPairs);

            render(() => (
                <GlobalProvider>
                    <Probe />
                </GlobalProvider>
            ));

            await globalSignals.fetchPairs();
            await globalSignals.fetchRegularPairs();

            expect(getPairsMock).toHaveBeenCalledTimes(2);
            // fetchPairs sends no override — fetcher will fall back to
            // getReferral() which is "pro" on the pro site.
            expect(getPairsMock).toHaveBeenNthCalledWith(1);
            // fetchRegularPairs must explicitly override with the regular
            // referral so the opportunity comparison sees non-pro rates.
            expect(getPairsMock).toHaveBeenNthCalledWith(2, {
                headers: { referral: "boltz_webapp_desktop" },
            });
        });
    });
});
