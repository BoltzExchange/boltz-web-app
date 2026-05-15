import { render } from "@solidjs/testing-library";
import type * as BoltzClientModule from "boltz-swaps/client";

import type * as ConfigModule from "../../src/config";
import { SwapType } from "../../src/consts/Enums";

const { getPairsMock, configMock } = vi.hoisted(() => ({
    getPairsMock: vi.fn<typeof BoltzClientModule.getPairs>(),
    configMock: { isPro: false } as { isPro: boolean },
}));

vi.mock("../../packages/boltz-swaps/src/client.ts", async () => {
    const actual = await vi.importActual<typeof BoltzClientModule>(
        "../../packages/boltz-swaps/src/client.ts",
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
        getPairsMock.mockReset();
        configMock.isPro = false;
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
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
