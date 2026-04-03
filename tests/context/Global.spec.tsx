import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import type * as FiatModule from "../../src/utils/fiat";

const { getBtcPriceFailoverMock } = vi.hoisted(() => ({
    getBtcPriceFailoverMock: vi.fn<typeof FiatModule.getBtcPriceFailover>(),
}));

vi.mock("../../src/utils/fiat", async () => {
    const actual = await vi.importActual<typeof FiatModule>(
        "../../src/utils/fiat",
    );

    return {
        ...actual,
        getBtcPriceFailover: getBtcPriceFailoverMock,
    };
});

const { GlobalProvider, useGlobalContext } =
    await import("../../src/context/Global");

describe("Global context", () => {
    let globalSignals: ReturnType<typeof useGlobalContext>;

    const Probe = () => {
        globalSignals = useGlobalContext();
        return null;
    };

    beforeEach(() => {
        getBtcPriceFailoverMock.mockReset();
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
});
