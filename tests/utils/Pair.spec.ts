import { BigNumber } from "bignumber.js";

import type * as ConfigModule from "../../src/config";
import { BTC, LBTC, LN, USDT0 } from "../../src/consts/Assets";
import Pair, { RequiredInput } from "../../src/utils/Pair";
import type * as BoltzClientModule from "../../src/utils/boltzClient";
import type { Pairs, QuoteData } from "../../src/utils/boltzClient";
import type * as SolanaModule from "../../src/utils/chains/solana";
import type * as OftModule from "../../src/utils/oft/oft";
import type * as QouterModule from "../../src/utils/qouter";

const {
    quoteDexAmountInMock,
    quoteDexAmountOutMock,
    quoteOftAmountInForAmountOutMock,
    quoteOftReceiveAmountMock,
    shouldCreateSolanaTokenAccountMock,
    fetchDexQuoteMock,
    fetchGasTokenQuoteMock,
    gasTopUpSupportedMock,
    getGasTopUpNativeAmountMock,
} = vi.hoisted(() => ({
    quoteDexAmountInMock: vi.fn<() => Promise<QuoteData[]>>(),
    quoteDexAmountOutMock: vi.fn<() => Promise<QuoteData[]>>(),
    quoteOftAmountInForAmountOutMock:
        vi.fn<typeof OftModule.quoteOftAmountInForAmountOut>(),
    quoteOftReceiveAmountMock: vi.fn<typeof OftModule.quoteOftReceiveAmount>(),
    shouldCreateSolanaTokenAccountMock:
        vi.fn<typeof SolanaModule.shouldCreateSolanaTokenAccount>(),
    fetchDexQuoteMock: vi.fn<typeof QouterModule.fetchDexQuote>(),
    fetchGasTokenQuoteMock: vi.fn<typeof QouterModule.fetchGasTokenQuote>(),
    gasTopUpSupportedMock: vi.fn<typeof QouterModule.gasTopUpSupported>(),
    getGasTopUpNativeAmountMock:
        vi.fn<typeof QouterModule.getGasTopUpNativeAmount>(),
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
    decodeExecutorNativeAmountExceedsCapError: (error: unknown) => {
        const data = (error as { data?: string })?.data;
        if (data === undefined || !data.startsWith("0x0084ce02")) {
            return undefined;
        }

        return {
            amount: BigInt(`0x${data.slice(10, 74)}`),
            cap: BigInt(`0x${data.slice(74, 138)}`),
        };
    },
    isExecutorNativeAmountExceedsCapError: (error: unknown) =>
        (error as { data?: string })?.data?.startsWith("0x0084ce02") ?? false,
    quoteOftAmountInForAmountOut: quoteOftAmountInForAmountOutMock,
    quoteOftReceiveAmount: quoteOftReceiveAmountMock,
}));

vi.mock("../../src/utils/chains/solana", async () => {
    const actual = await vi.importActual<typeof SolanaModule>(
        "../../src/utils/chains/solana",
    );

    return {
        ...actual,
        shouldCreateSolanaTokenAccount: shouldCreateSolanaTokenAccountMock,
    };
});

vi.mock("../../src/utils/qouter", () => ({
    fetchDexQuote: fetchDexQuoteMock,
    fetchGasTokenQuote: fetchGasTokenQuoteMock,
    gasTopUpSupported: gasTopUpSupportedMock,
    getGasTopUpNativeAmount: getGasTopUpNativeAmountMock,
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
    reverse: {
        BTC: {
            USDT0: {
                hash: "ln-usdt0-pair-hash",
                rate: 1,
                limits: {
                    maximal: 1_000_000,
                    minimal: 1,
                },
                fees: {
                    percentage: 0,
                    minerFees: {
                        claim: 0,
                        lockup: 0,
                    },
                },
            },
        },
    },
    chain: {},
};

describe("Pair", () => {
    beforeEach(() => {
        quoteDexAmountInMock.mockReset();
        quoteDexAmountOutMock.mockReset();
        quoteOftAmountInForAmountOutMock.mockReset();
        quoteOftReceiveAmountMock.mockReset();
        shouldCreateSolanaTokenAccountMock.mockReset();
        fetchDexQuoteMock.mockReset();
        fetchGasTokenQuoteMock.mockReset();
        gasTopUpSupportedMock.mockReset();
        getGasTopUpNativeAmountMock.mockReset();
        gasTopUpSupportedMock.mockReturnValue(true);
        shouldCreateSolanaTokenAccountMock.mockResolvedValue(false);
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

    test("should reject fallback routes that require a chain-swap Boltz hop", () => {
        const chainOnlyFallbackPairs: Pairs = {
            ...pairs,
            chain: {
                LBTC: {
                    TBTC: {
                        hash: "lbtc-tbtc-chain-hop",
                        rate: 1,
                        limits: {
                            maximal: 1_000_000,
                            minimal: 1,
                            maximalZeroConf: 0,
                        },
                        fees: {
                            percentage: 0,
                            minerFees: {
                                server: 0,
                                user: {
                                    claim: 0,
                                    lockup: 0,
                                },
                            },
                        },
                    },
                },
            },
        };

        const pair = new Pair(chainOnlyFallbackPairs, LBTC, USDT0);

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
            undefined,
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

    test("should cache OFT transfer fees in reverse quotes for post-OFT pairs", async () => {
        quoteOftAmountInForAmountOutMock.mockResolvedValue(1_030n);
        quoteOftReceiveAmountMock.mockResolvedValue(
            makeOftQuote({
                amountIn: 1_030n,
                amountOut: 1_000n,
                msgFee: 0n,
            }),
        );

        const pair = new Pair(pairs, LN, "USDT0-POL");
        const sendAmount = await pair.calculateSendAmount(BigNumber(1_000), 0);

        expect(sendAmount.toNumber()).toBe(1_030);
        expect(pair.oftTransferFeeFromLatestQuote(sendAmount)?.toNumber()).toBe(
            30,
        );
        expect(pair.oftTransferFeeAsset).toBe("USDT0-POL");
    });

    test("should include OFT native drop costs in post-OFT receive quotes", async () => {
        getGasTopUpNativeAmountMock.mockResolvedValue(77n);
        quoteDexAmountOutMock.mockResolvedValue([
            {
                quote: "100",
                data: { route: "native-fee" },
            },
        ]);
        quoteOftReceiveAmountMock.mockImplementation((_route, amount) =>
            Promise.resolve(
                makeOftQuote({
                    amountIn: amount,
                    amountOut: amount,
                    msgFee: 25n,
                }),
            ),
        );

        const pair = new Pair(pairs, LN, "USDT0-POL");
        const recipient = "0x5000000000000000000000000000000000000000";

        const receiveAmount = await pair.calculateReceiveAmount(
            BigNumber(1_000),
            0,
            undefined,
            true,
            recipient,
        );

        expect(receiveAmount.toNumber()).toBe(900);
        expect(quoteOftReceiveAmountMock).toHaveBeenCalledTimes(2);
        expect(quoteOftReceiveAmountMock).toHaveBeenNthCalledWith(
            1,
            {
                from: USDT0,
                to: "USDT0-POL",
            },
            1000n,
            {
                recipient,
                nativeDrop: {
                    amount: 77n,
                    receiver: recipient,
                },
            },
        );
        expect(quoteOftReceiveAmountMock).toHaveBeenNthCalledWith(
            2,
            {
                from: USDT0,
                to: "USDT0-POL",
            },
            900n,
            {
                recipient,
                nativeDrop: {
                    amount: 77n,
                    receiver: recipient,
                },
            },
        );
        expect(fetchGasTokenQuoteMock).not.toHaveBeenCalled();
        expect(getGasTopUpNativeAmountMock).toHaveBeenCalledWith("USDT0-POL");
        expect(pair.oftMessagingFeeFromLatestQuote(BigNumber(1_000))).toBe(25n);
    });

    test("should fall back when post-OFT native drop exceeds the executor cap", async () => {
        getGasTopUpNativeAmountMock.mockResolvedValue(77n);
        quoteDexAmountOutMock.mockResolvedValue([
            {
                quote: "0",
                data: { route: "native-fee" },
            },
        ]);
        quoteOftReceiveAmountMock.mockImplementation(
            (_route, amount, options) => {
                if (options?.nativeDrop !== undefined) {
                    throw {
                        data: "0x0084ce020000000000000000000000000000000000000000000000000c49bf8c0491425000000000000000000000000000000000000000000000000002ea11e32ad50000",
                    };
                }

                return Promise.resolve(
                    makeOftQuote({
                        amountIn: amount,
                        amountOut: amount === 1_000n ? 900n : amount,
                        msgFee: 5n,
                    }),
                );
            },
        );

        const pair = new Pair(pairs, LN, "USDT0-POL");
        const recipient = "0x5000000000000000000000000000000000000000";

        await expect(
            pair.calculateReceiveAmount(
                BigNumber(1_000),
                0,
                undefined,
                true,
                recipient,
            ),
        ).resolves.toEqual(BigNumber(900));

        await expect(pair.canPostOftNativeDrop(recipient)).resolves.toBe(false);
    });
});
