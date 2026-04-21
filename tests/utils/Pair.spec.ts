import { BigNumber } from "bignumber.js";
import log from "loglevel";

import type * as ConfigModule from "../../src/config";
import { BTC, LBTC, LN, USDT0 } from "../../src/consts/Assets";
import Pair, { RequiredInput } from "../../src/utils/Pair";
import type * as BoltzClientModule from "../../src/utils/boltzClient";
import type { Pairs, QuoteData } from "../../src/utils/boltzClient";
import type * as QuoterModule from "../../src/utils/quoter";

const {
    quoteDexAmountInMock,
    quoteDexAmountOutMock,
    bridgeBuildQuoteOptionsMock,
    bridgeGetDriverForAssetMock,
    bridgeGetMessagingFeeTokenMock,
    bridgeGetNativeDropFailureMock,
    bridgeGetPostRouteMock,
    bridgeGetPreRouteMock,
    bridgeGetTransferFeeAssetMock,
    bridgeQuoteAmountInForAmountOutMock,
    bridgeQuoteReceiveAmountMock,
    fetchDexQuoteMock,
    fetchGasTokenQuoteMock,
    gasTopUpSupportedMock,
    getGasTopUpNativeAmountMock,
} = vi.hoisted(() => ({
    quoteDexAmountInMock: vi.fn<() => Promise<QuoteData[]>>(),
    quoteDexAmountOutMock: vi.fn<() => Promise<QuoteData[]>>(),
    bridgeBuildQuoteOptionsMock: vi.fn(),
    bridgeGetDriverForAssetMock: vi.fn(),
    bridgeGetMessagingFeeTokenMock: vi.fn(),
    bridgeGetNativeDropFailureMock: vi.fn(),
    bridgeGetPostRouteMock: vi.fn(),
    bridgeGetPreRouteMock: vi.fn(),
    bridgeGetTransferFeeAssetMock: vi.fn(),
    bridgeQuoteAmountInForAmountOutMock: vi.fn(),
    bridgeQuoteReceiveAmountMock: vi.fn(),
    fetchDexQuoteMock: vi.fn<typeof QuoterModule.fetchDexQuote>(),
    fetchGasTokenQuoteMock: vi.fn<typeof QuoterModule.fetchGasTokenQuote>(),
    gasTopUpSupportedMock: vi.fn<typeof QuoterModule.gasTopUpSupported>(),
    getGasTopUpNativeAmountMock:
        vi.fn<typeof QuoterModule.getGasTopUpNativeAmount>(),
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
                    // Intentionally omits `token.routeVia` to mirror real mainnet
                    // variants, which inherit routing from the canonical asset.
                    token: {
                        address: "0x0000000000000000000000000000000000000137",
                        decimals: 6,
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
                "USDT0-DIS": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
                    disabled: true,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Disabled Chain",
                        symbol: "DIS",
                        gasToken: "DIS",
                        chainId: 9999,
                        nativeCurrency: {
                            name: "DIS",
                            symbol: "DIS",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000009999",
                    },
                },
                "TBTC-DIS": {
                    ...actual.config.assets.TBTC,
                    disabled: true,
                    token: {
                        ...actual.config.assets.TBTC.token,
                        address: "0x0000000000000000000000000000000000008888",
                    },
                },
                "ROUTED-DIS": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Routed Disabled",
                        symbol: "RDIS",
                        gasToken: "RDIS",
                        chainId: 8888,
                        nativeCurrency: {
                            name: "RDIS",
                            symbol: "RDIS",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000008889",
                        routeVia: "TBTC-DIS",
                    },
                },
            },
        },
    };
});

vi.mock("../../src/utils/bridge/registry", () => ({
    bridgeRegistry: {
        getDriverForAsset: bridgeGetDriverForAssetMock,
    },
}));

vi.mock("../../src/utils/quoter", () => ({
    fetchDexQuote: fetchDexQuoteMock,
    fetchGasTokenQuote: fetchGasTokenQuoteMock,
    gasTopUpSupported: gasTopUpSupportedMock,
    getGasTopUpNativeAmount: getGasTopUpNativeAmountMock,
}));

const tbtcAssetAmount = (sats: number) =>
    (BigInt(sats) * 10_000_000_000n).toString();

const makeBridgeQuote = ({
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
    bridgeLimit: [0n, 0n] as [bigint, bigint],
    bridgeFeeDetails: [],
    bridgeReceipt: [amountIn, amountOut] as [bigint, bigint],
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
    chain: {
        BTC: {
            [LBTC]: {
                hash: "btc-lbtc-pair-hash",
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
            USDT0: {
                hash: "btc-usdt0-pair-hash",
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

describe("Pair", () => {
    beforeEach(() => {
        quoteDexAmountInMock.mockReset();
        quoteDexAmountOutMock.mockReset();
        bridgeBuildQuoteOptionsMock.mockReset();
        bridgeGetDriverForAssetMock.mockReset();
        bridgeGetMessagingFeeTokenMock.mockReset();
        bridgeGetNativeDropFailureMock.mockReset();
        bridgeGetPostRouteMock.mockReset();
        bridgeGetPreRouteMock.mockReset();
        bridgeGetTransferFeeAssetMock.mockReset();
        bridgeQuoteAmountInForAmountOutMock.mockReset();
        bridgeQuoteReceiveAmountMock.mockReset();
        fetchDexQuoteMock.mockReset();
        fetchGasTokenQuoteMock.mockReset();
        gasTopUpSupportedMock.mockReset();
        getGasTopUpNativeAmountMock.mockReset();
        gasTopUpSupportedMock.mockReturnValue(true);
        bridgeGetPreRouteMock.mockImplementation((asset: string) =>
            asset === "USDT0-POL"
                ? {
                      sourceAsset: "USDT0-POL",
                      destinationAsset: USDT0,
                  }
                : undefined,
        );
        bridgeGetPostRouteMock.mockImplementation((asset: string) =>
            asset === "USDT0-POL"
                ? {
                      sourceAsset: USDT0,
                      destinationAsset: "USDT0-POL",
                  }
                : undefined,
        );
        bridgeBuildQuoteOptionsMock.mockImplementation(
            async (
                destinationAsset: string,
                destination: string,
                getGasToken: boolean,
            ) => ({
                recipient: destination,
                nativeDrop:
                    getGasToken && gasTopUpSupportedMock(destinationAsset)
                        ? {
                              amount: await getGasTopUpNativeAmountMock(
                                  destinationAsset,
                              ),
                              receiver: destination,
                          }
                        : undefined,
            }),
        );
        bridgeGetMessagingFeeTokenMock.mockImplementation(
            (route: { sourceAsset: string }) =>
                route.sourceAsset === "USDT0-POL" ? "POL" : "ETH",
        );
        bridgeGetTransferFeeAssetMock.mockImplementation(
            (route: { sourceAsset: string }) => route.sourceAsset,
        );
        bridgeGetNativeDropFailureMock.mockImplementation(
            (error: { data?: string }) => {
                const data = error.data;
                if (data === undefined || !data.startsWith("0x0084ce02")) {
                    return undefined;
                }

                return {
                    reason: "exceeds_cap",
                    amount: BigInt(`0x${data.slice(10, 74)}`),
                    cap: BigInt(`0x${data.slice(74, 138)}`),
                };
            },
        );

        const bridgeDriver = {
            getPreRoute: bridgeGetPreRouteMock,
            getPostRoute: bridgeGetPostRouteMock,
            buildQuoteOptions: bridgeBuildQuoteOptionsMock,
            quoteReceiveAmount: bridgeQuoteReceiveAmountMock,
            quoteAmountInForAmountOut: bridgeQuoteAmountInForAmountOutMock,
            getMessagingFeeToken: bridgeGetMessagingFeeTokenMock,
            getTransferFeeAsset: bridgeGetTransferFeeAssetMock,
            getNativeDropFailure: bridgeGetNativeDropFailureMock,
        };

        bridgeGetDriverForAssetMock.mockImplementation((asset: string) =>
            asset === "USDT0-POL" ? bridgeDriver : undefined,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should return undefined maxRoutingFee for invalid pairs", () => {
        const pair = new Pair(undefined, "NONEXISTENT", LN);
        expect(pair.isRoutable).toBe(false);
        expect(pair.maxRoutingFee).toBeUndefined();
    });

    test("should route bridge variants that inherit routeVia from the canonical asset", () => {
        // USDT0-POL has no own `token.routeVia` — it must inherit "TBTC" from
        // the canonical USDT0 asset for the DEX hop to be discovered in either
        // direction.
        expect(new Pair(pairs, "USDT0-POL", LN).isRoutable).toBe(true);
        expect(new Pair(pairs, LN, "USDT0-POL").isRoutable).toBe(true);
    });

    test("should treat unsupported send variants as non-routable", () => {
        const pair = new Pair(pairs, "USDT0-CFX", LN);

        expect(pair.isRoutable).toBe(false);
        expect(pair.swapToCreate).toBeUndefined();
        expect(pair.requiredInput).toBe(RequiredInput.Unknown);
    });

    test("should treat disabled `from` asset as non-routable", () => {
        const infoSpy = vi.spyOn(log, "info").mockImplementation(() => {});
        const pair = new Pair(pairs, "USDT0-DIS", LN);

        expect(pair.isRoutable).toBe(false);
        expect(pair.swapToCreate).toBeUndefined();
        expect(pair.requiredInput).toBe(RequiredInput.Unknown);
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining("disabled asset"),
        );
    });

    test("should treat disabled `to` asset as non-routable", () => {
        const infoSpy = vi.spyOn(log, "info").mockImplementation(() => {});
        const pair = new Pair(pairs, BTC, "USDT0-DIS");

        expect(pair.isRoutable).toBe(false);
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining("disabled asset"),
        );
    });

    test("should treat routes with a disabled intermediary asset as non-routable", () => {
        const infoSpy = vi.spyOn(log, "info").mockImplementation(() => {});
        const pairsWithDisabledRoute: Pairs = {
            ...pairs,
            submarine: {
                ...pairs.submarine,
                "TBTC-DIS": {
                    BTC: pairs.submarine.TBTC.BTC,
                },
            },
        };
        const pair = new Pair(pairsWithDisabledRoute, "ROUTED-DIS", LN);

        expect(pair.isRoutable).toBe(false);
        expect(pair.swapToCreate).toBeUndefined();
        expect(pair.requiredInput).toBe(RequiredInput.Unknown);
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining("TBTC-DIS"),
        );
    });

    test("should allow 0-amount direct non-EVM chain swaps without logging blockers", () => {
        const debugSpy = vi.spyOn(log, "debug").mockImplementation(() => {});
        const pair = new Pair(pairs, BTC, LBTC);

        debugSpy.mockClear();

        expect(pair.canZeroAmount).toBe(true);
        expect(debugSpy).not.toHaveBeenCalled();
    });

    test("should allow 0-amount chain swaps with post-bridge routing", () => {
        const debugSpy = vi.spyOn(log, "debug").mockImplementation(() => {});
        const pair = new Pair(pairs, BTC, "USDT0-POL");

        debugSpy.mockClear();

        expect(pair.canZeroAmount).toBe(true);
        expect(debugSpy).not.toHaveBeenCalled();
    });

    test("should log blockers when 0-amount swaps are disabled by routing", () => {
        const debugSpy = vi.spyOn(log, "debug").mockImplementation(() => {});
        const pair = new Pair(pairs, LN, "USDT0-POL");

        debugSpy.mockClear();

        expect(pair.canZeroAmount).toBe(false);
        expect(debugSpy).toHaveBeenCalledWith(
            "0-amount swap disabled for pair",
            expect.objectContaining({
                from: LN,
                to: "USDT0-POL",
                blockers: ["first hop type is reverse"],
                route: [
                    {
                        from: LN,
                        to: USDT0,
                        type: "reverse",
                    },
                ],
                hasPreBridge: false,
                hasPostBridge: true,
            }),
        );
    });

    test("should log missing route blockers when 0-amount swaps are not routable", () => {
        const debugSpy = vi.spyOn(log, "debug").mockImplementation(() => {});
        const pair = new Pair(undefined, "NONEXISTENT", LN);

        expect(pair.canZeroAmount).toBe(false);
        expect(debugSpy).toHaveBeenCalledWith(
            "0-amount swap disabled for pair",
            expect.objectContaining({
                from: "NONEXISTENT",
                to: LN,
                blockers: ["route has no first hop"],
                route: [],
                hasPreBridge: false,
                hasPostBridge: false,
            }),
        );
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

    test("should quote bridge send variants before routed Boltz swaps", async () => {
        bridgeQuoteReceiveAmountMock.mockResolvedValueOnce(
            makeBridgeQuote({
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
        expect(pair.bridgeMessagingFeeFromLatestQuote(sendAmount)).toBe(10n);
        expect(pair.bridgeMessagingFeeToken).toBe("POL");
    });

    test("should include bridge source messaging fees in reverse quotes", async () => {
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
        bridgeQuoteAmountInForAmountOutMock.mockResolvedValue(1_000_000n);
        bridgeQuoteReceiveAmountMock.mockResolvedValue(
            makeBridgeQuote({
                amountIn: 1_000_000n,
                amountOut: 999_970n,
                msgFee: 25n,
            }),
        );

        const pair = new Pair(pairs, "USDT0-POL", LN);
        const sendAmount = await pair.calculateSendAmount(BigNumber(1480), 0);
        const creationData = await pair.creationData(sendAmount, 0);

        expect(sendAmount.toNumber()).toBe(1_000_000);
        expect(pair.hasPreBridge).toBe(true);
        expect(pair.hasPostBridge).toBe(false);
        expect(pair.bridgeMessagingFeeFromLatestQuote(sendAmount)).toBe(25n);
        expect(pair.bridgeMessagingFeeToken).toBe("POL");
        expect(
            pair.bridgeTransferFeeFromLatestQuote(sendAmount)?.toNumber(),
        ).toBe(30);
        expect(pair.bridgeTransferFeeAsset).toBe("USDT0-POL");
        expect(
            pair.boltzSwapSendAmountFromLatestQuote(sendAmount)?.toNumber(),
        ).toBe(1480);
        expect(creationData?.sendAmount.toNumber()).toBe(1480);
        expect(creationData?.hops[0]?.from).toBe(USDT0);
        expect(creationData?.to).toBe(BTC);
    });

    test("should cache bridge transfer fees in reverse quotes for post-bridge pairs", async () => {
        bridgeQuoteAmountInForAmountOutMock.mockResolvedValue(1_030n);
        bridgeQuoteReceiveAmountMock.mockResolvedValue(
            makeBridgeQuote({
                amountIn: 1_030n,
                amountOut: 1_000n,
                msgFee: 0n,
            }),
        );

        const pair = new Pair(pairs, LN, "USDT0-POL");
        const sendAmount = await pair.calculateSendAmount(BigNumber(1_000), 0);

        expect(sendAmount.toNumber()).toBe(1_030);
        expect(pair.hasPreBridge).toBe(false);
        expect(pair.hasPostBridge).toBe(true);
        expect(
            pair.bridgeTransferFeeFromLatestQuote(sendAmount)?.toNumber(),
        ).toBe(30);
        expect(pair.bridgeTransferFeeAsset).toBe(USDT0);
    });

    test("should include bridge native drop costs in post-bridge receive quotes", async () => {
        getGasTopUpNativeAmountMock.mockResolvedValue(77n);
        quoteDexAmountOutMock.mockResolvedValue([
            {
                quote: "100",
                data: { route: "native-fee" },
            },
        ]);
        bridgeQuoteReceiveAmountMock.mockImplementation((_route, amount) =>
            Promise.resolve(
                makeBridgeQuote({
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

        const route = {
            sourceAsset: USDT0,
            destinationAsset: "USDT0-POL",
        };

        expect(receiveAmount.toNumber()).toBe(900);
        expect(bridgeQuoteReceiveAmountMock).toHaveBeenCalledTimes(2);
        expect(bridgeQuoteReceiveAmountMock).toHaveBeenNthCalledWith(
            1,
            route,
            1000n,
            {
                recipient,
                nativeDrop: {
                    amount: 77n,
                    receiver: recipient,
                },
            },
        );
        expect(bridgeQuoteReceiveAmountMock).toHaveBeenNthCalledWith(
            2,
            route,
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
        expect(pair.bridgeMessagingFeeFromLatestQuote(BigNumber(1_000))).toBe(
            25n,
        );
    });

    test("should fall back when post-bridge native drop exceeds the executor cap", async () => {
        getGasTopUpNativeAmountMock.mockResolvedValue(77n);
        quoteDexAmountOutMock.mockResolvedValue([
            {
                quote: "0",
                data: { route: "native-fee" },
            },
        ]);
        bridgeQuoteReceiveAmountMock.mockImplementation(
            (_route, amount, options) => {
                if (options?.nativeDrop !== undefined) {
                    throw {
                        data: "0x0084ce020000000000000000000000000000000000000000000000000c49bf8c0491425000000000000000000000000000000000000000000000000002ea11e32ad50000",
                    };
                }

                return Promise.resolve(
                    makeBridgeQuote({
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

        await expect(pair.canPostBridgeNativeDrop(recipient)).resolves.toBe(
            false,
        );
    });

    test("should treat missing driver native-drop options as unsupported", async () => {
        bridgeBuildQuoteOptionsMock.mockResolvedValue({
            recipient: "0x5000000000000000000000000000000000000000",
        });

        const pair = new Pair(pairs, LN, "USDT0-POL");
        const recipient = "0x5000000000000000000000000000000000000000";

        await expect(pair.canPostBridgeNativeDrop(recipient)).resolves.toBe(
            false,
        );
        expect(bridgeQuoteReceiveAmountMock).not.toHaveBeenCalled();
    });

    test("should rethrow unclassified post-bridge native-drop quote failures", async () => {
        getGasTopUpNativeAmountMock.mockResolvedValue(77n);
        const error = new Error("quote failed");
        bridgeGetNativeDropFailureMock.mockReturnValue(undefined);
        bridgeQuoteReceiveAmountMock.mockRejectedValue(error);

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
        ).rejects.toBe(error);
    });
});
