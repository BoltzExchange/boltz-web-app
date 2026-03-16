import { BigNumber } from "bignumber.js";

import type * as ConfigModule from "../../src/config";
import { BTC, LN, USDT0 } from "../../src/consts/Assets";
import Pair, { RequiredInput } from "../../src/utils/Pair";
import type * as BoltzClientModule from "../../src/utils/boltzClient";
import type { Pairs, QuoteData } from "../../src/utils/boltzClient";
import type * as OftModule from "../../src/utils/oft/oft";
import type * as QouterModule from "../../src/utils/qouter";

const {
    quoteDexAmountInMock,
    quoteDexAmountOutMock,
    quoteOftAmountInForAmountOutMock,
    quoteOftReceiveAmountMock,
    fetchDexQuoteMock,
    fetchGasTokenQuoteMock,
} = vi.hoisted(() => ({
    quoteDexAmountInMock: vi.fn<() => Promise<QuoteData[]>>(),
    quoteDexAmountOutMock: vi.fn<() => Promise<QuoteData[]>>(),
    quoteOftAmountInForAmountOutMock:
        vi.fn<typeof OftModule.quoteOftAmountInForAmountOut>(),
    quoteOftReceiveAmountMock: vi.fn<typeof OftModule.quoteOftReceiveAmount>(),
    fetchDexQuoteMock: vi.fn<typeof QouterModule.fetchDexQuote>(),
    fetchGasTokenQuoteMock: vi.fn<typeof QouterModule.fetchGasTokenQuote>(),
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

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: {
            ...actual.config,
            assets: {
                ...actual.config.assets,
                "USDT0-POL": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Polygon PoS",
                        symbol: "POL",
                        gasToken: "POL",
                        chainId: 137,
                        nativeCurrency: {
                            name: "POL",
                            symbol: "POL",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000000137",
                    },
                },
                "USDT0-CFX": {
                    ...actual.config.assets.USDT0,
                    canSend: false,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Conflux eSpace",
                        symbol: "CFX",
                        gasToken: "CFX",
                        chainId: 1030,
                        nativeCurrency: {
                            name: "CFX",
                            symbol: "CFX",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000001030",
                    },
                },
            },
        },
    };
});

vi.mock("../../src/utils/oft/oft", () => ({
    quoteOftAmountInForAmountOut: quoteOftAmountInForAmountOutMock,
    quoteOftReceiveAmount: quoteOftReceiveAmountMock,
}));

vi.mock("../../src/utils/qouter", () => ({
    fetchDexQuote: fetchDexQuoteMock,
    fetchGasTokenQuote: fetchGasTokenQuoteMock,
}));

const tbtcAssetAmount = (sats: number) =>
    (BigInt(sats) * 10_000_000_000n).toString();

const makeOftQuote = ({
    amountIn,
    amountOut,
    msgFee,
}: {
    amountIn: bigint;
    amountOut: bigint;
    msgFee: bigint;
}) => ({
    amountIn,
    amountOut,
    msgFee: [msgFee, 0n] as [bigint, bigint],
    oftLimit: [0n, 0n] as [bigint, bigint],
    oftFeeDetails: [],
    oftReceipt: [amountIn, amountOut] as [bigint, bigint],
});

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
        quoteOftAmountInForAmountOutMock.mockReset();
        quoteOftReceiveAmountMock.mockReset();
        fetchDexQuoteMock.mockReset();
        fetchGasTokenQuoteMock.mockReset();
    });

    test("should return undefined maxRoutingFee for invalid pairs", () => {
        const pair = new Pair(undefined, "NONEXISTENT", LN);
        expect(pair.isRoutable).toBe(false);
        expect(pair.maxRoutingFee).toBeUndefined();
    });

    test("should treat unsupported send variants as non-routable", () => {
        const pair = new Pair(pairs, "USDT0-CFX", LN);

        expect(pair.isRoutable).toBe(false);
        expect(pair.swapToCreate).toBeUndefined();
        expect(pair.requiredInput).toBe(RequiredInput.Unknown);
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

    test("should quote OFT send variants before routed Boltz swaps", async () => {
        quoteOftReceiveAmountMock.mockResolvedValueOnce(
            makeOftQuote({
                amountIn: 2_000n,
                amountOut: 2_000n,
                msgFee: 10n,
            }),
        );
        fetchDexQuoteMock.mockResolvedValue({
            trade: {
                amountIn: 2_000n,
                amountOut: BigInt(tbtcAssetAmount(1480)),
                data: { route: "exact-in" },
            },
        });

        const pair = new Pair(pairs, "USDT0-POL", LN);
        const sendAmount = BigNumber(2000);

        const receiveAmount = await pair.calculateReceiveAmount(sendAmount, 0);

        expect(pair.fromAsset).toBe("USDT0-POL");
        expect(pair.isRoutable).toBe(true);
        expect(receiveAmount.toNumber()).toBe(1480);
        expect(fetchDexQuoteMock).toHaveBeenCalledWith(
            expect.anything(),
            2000n,
            false,
        );
        expect(pair.oftMessagingFeeFromLatestQuote(sendAmount)).toBe(10n);
        expect(pair.oftMessagingFeeToken).toBe("POL");
    });

    test("should include OFT source messaging fees in reverse quotes", async () => {
        quoteDexAmountOutMock.mockResolvedValueOnce([
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
        quoteOftAmountInForAmountOutMock.mockResolvedValue(1_000_000n);
        quoteOftReceiveAmountMock.mockResolvedValue(
            makeOftQuote({
                amountIn: 1_000_000n,
                amountOut: 1_000_000n,
                msgFee: 25n,
            }),
        );

        const pair = new Pair(pairs, "USDT0-POL", LN);
        const sendAmount = await pair.calculateSendAmount(BigNumber(1480), 0);
        const creationData = await pair.creationData(sendAmount, 0);

        expect(sendAmount.toNumber()).toBe(1_000_000);
        expect(pair.oftMessagingFeeFromLatestQuote(sendAmount)).toBe(25n);
        expect(pair.oftMessagingFeeToken).toBe("POL");
        expect(
            pair.boltzSwapSendAmountFromLatestQuote(sendAmount)?.toNumber(),
        ).toBe(1480);
        expect(creationData?.sendAmount.toNumber()).toBe(1480);
        expect(creationData?.hops[0]?.from).toBe(USDT0);
        expect(creationData?.to).toBe(BTC);
    });
});
