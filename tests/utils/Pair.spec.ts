import { BigNumber } from "bignumber.js";

import { LN, USDT0 } from "../../src/consts/Assets";
import Pair from "../../src/utils/Pair";
import type * as BoltzClientModule from "../../src/utils/boltzClient";
import type { Pairs, QuoteData } from "../../src/utils/boltzClient";

const { quoteDexAmountInMock, quoteDexAmountOutMock } = vi.hoisted(() => ({
    quoteDexAmountInMock: vi.fn<() => Promise<QuoteData[]>>(),
    quoteDexAmountOutMock: vi.fn<() => Promise<QuoteData[]>>(),
}));

vi.mock("../../src/utils/boltzClient", async () => {
    const actual = await vi.importActual<typeof BoltzClientModule>(
        "../../src/utils/boltzClient",
    );

    return {
        ...actual,
        quoteDexAmountIn: quoteDexAmountInMock,
        quoteDexAmountOut: quoteDexAmountOutMock,
    };
});

const tbtcAssetAmount = (sats: number) =>
    (BigInt(sats) * 10_000_000_000n).toString();

const pairs: Pairs = {
    submarine: {
        TBTC: {
            BTC: {
                hash: "tbtc-ln-pair-hash",
                rate: 1,
                limits: {
                    maximal: 1_000_000,
                    minimal: 1,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0,
                    minerFees: 0,
                },
            },
        },
    },
    reverse: {},
    chain: {},
};

describe("Pair", () => {
    beforeEach(() => {
        quoteDexAmountInMock.mockReset();
        quoteDexAmountOutMock.mockReset();
    });

    test("should keep the cached Boltz send amount for routed submarine creation", async () => {
        quoteDexAmountOutMock.mockResolvedValue([
            {
                quote: "1000000",
                data: { route: "exact-out" },
            },
        ]);
        quoteDexAmountInMock.mockResolvedValue([
            {
                quote: tbtcAssetAmount(1479),
                data: { route: "exact-in" },
            },
        ]);

        const pair = new Pair(pairs, USDT0, LN);

        const sendAmount = await pair.calculateSendAmount(BigNumber(1480), 0);
        expect(sendAmount.toNumber()).toBe(1_000_000);
        expect(
            pair.boltzSwapSendAmountFromLatestQuote(sendAmount)?.toNumber(),
        ).toBe(1480);

        const creationData = await pair.creationData(sendAmount, 0);

        expect(creationData?.sendAmount.toNumber()).toBe(1480);
        expect(creationData?.receiveAmount.toNumber()).toBe(1480);
    });
});
