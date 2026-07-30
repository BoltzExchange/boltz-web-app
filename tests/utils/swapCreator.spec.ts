import { BridgeKind, SwapPosition, SwapType } from "boltz-swaps/types";

import { BTC, LBTC, LN, USDT0 } from "../../src/consts/Assets";
import {
    type BridgeDetail,
    type DexDetail,
    type SwapAssetRoute,
    type SwapBase,
    createLocalSwapId,
    getFinalAssetReceive,
    getFinalAssetSend,
    getPostBridgeDetail,
    getPreBridgeDetail,
    getRefundBridgeDetail,
    noGasAbstraction,
} from "../../src/utils/swapCreator";

const makeBridge = (
    sourceAsset: string,
    destinationAsset: string,
    position: SwapPosition,
): BridgeDetail => ({
    kind: BridgeKind.Oft,
    sourceAsset,
    destinationAsset,
    position,
});

// Minimal SwapBase builder — only fields read by the tested helpers matter.
const makeSwap = (overrides: Partial<SwapBase>): SwapBase =>
    ({
        type: SwapType.Reverse,
        assetSend: LN,
        assetReceive: BTC,
        sendAmount: 0,
        receiveAmount: 0,
        version: 0,
        date: 0,
        gasAbstraction: noGasAbstraction(),
        ...overrides,
    }) as SwapBase;

describe("createLocalSwapId", () => {
    test("creates local-only ids from eight random bytes", () => {
        expect(createLocalSwapId()).toMatch(/^[0-9a-f]{16}$/);
    });
});
describe("getPreBridgeDetail", () => {
    test("returns the bridge when its position is Pre", () => {
        const bridge = makeBridge("USDT0-ETH", USDT0, SwapPosition.Pre);
        expect(getPreBridgeDetail(bridge)).toBe(bridge);
    });

    test("returns undefined when the bridge is Post", () => {
        const bridge = makeBridge(USDT0, "USDT0-POL", SwapPosition.Post);
        expect(getPreBridgeDetail(bridge)).toBeUndefined();
    });

    test("returns undefined when no bridge is provided", () => {
        expect(getPreBridgeDetail(undefined)).toBeUndefined();
    });
});

describe("getPostBridgeDetail", () => {
    test("returns the bridge when its position is Post", () => {
        const bridge = makeBridge(USDT0, "USDT0-POL", SwapPosition.Post);
        expect(getPostBridgeDetail(bridge)).toBe(bridge);
    });

    test("returns undefined when the bridge is Pre", () => {
        const bridge = makeBridge("USDT0-ETH", USDT0, SwapPosition.Pre);
        expect(getPostBridgeDetail(bridge)).toBeUndefined();
    });

    test("returns undefined when no bridge is provided", () => {
        expect(getPostBridgeDetail(undefined)).toBeUndefined();
    });
});

describe("getRefundBridgeDetail", () => {
    const makeDex = (position: SwapPosition): DexDetail => ({
        hops: [],
        position,
        quoteAmount: 0,
    });

    const preDex = makeDex(SwapPosition.Pre);
    const preBridgeWithTx = {
        ...makeBridge("USDT0-POL", USDT0, SwapPosition.Pre),
        txHash: "0xdead",
    };

    test("returns the pre-bridge when the forward bridge transaction is known", () => {
        expect(
            getRefundBridgeDetail({
                dex: preDex,
                bridge: preBridgeWithTx,
            }),
        ).toBe(preBridgeWithTx);
    });

    test("returns undefined without the forward bridge transaction", () => {
        expect(
            getRefundBridgeDetail({
                dex: preDex,
                bridge: makeBridge("USDT0-POL", USDT0, SwapPosition.Pre),
            }),
        ).toBeUndefined();
    });

    test("returns undefined without a pre-swap DEX route", () => {
        expect(
            getRefundBridgeDetail({ bridge: preBridgeWithTx }),
        ).toBeUndefined();
        expect(
            getRefundBridgeDetail({
                dex: makeDex(SwapPosition.Post),
                bridge: preBridgeWithTx,
            }),
        ).toBeUndefined();
    });

    test("returns undefined for post-bridges", () => {
        expect(
            getRefundBridgeDetail({
                dex: preDex,
                bridge: {
                    ...makeBridge(USDT0, "USDT0-POL", SwapPosition.Post),
                    txHash: "0xdead",
                },
            }),
        ).toBeUndefined();
    });

    test("returns undefined when no bridge is attached", () => {
        expect(getRefundBridgeDetail({ dex: preDex })).toBeUndefined();
    });
});

describe("getFinalAssetSend", () => {
    test("returns bridge.sourceAsset when a pre-bridge is attached", () => {
        const swap = makeSwap({
            assetSend: USDT0,
            bridge: makeBridge("USDT0-ETH", USDT0, SwapPosition.Pre),
        });
        expect(getFinalAssetSend(swap)).toBe("USDT0-ETH");
    });

    test("ignores a post-bridge and falls through to dex/assetSend", () => {
        const swap = makeSwap({
            assetSend: BTC,
            bridge: makeBridge(USDT0, "USDT0-POL", SwapPosition.Post),
        });
        expect(getFinalAssetSend(swap)).toBe(BTC);
    });

    test("returns the first DEX hop's `from` for pre-DEX-hop swaps", () => {
        const swap = makeSwap({
            assetSend: USDT0,
            dex: {
                hops: [
                    {
                        type: SwapType.Dex,
                        from: "TBTC",
                        to: USDT0,
                    },
                ],
                position: SwapPosition.Pre,
                quoteAmount: 0,
            },
        });
        expect(getFinalAssetSend(swap)).toBe("TBTC");
    });

    test("coalesces to LN for reverse swaps when requested", () => {
        const swap = makeSwap({
            type: SwapType.Reverse,
            assetSend: LN,
        });
        expect(getFinalAssetSend(swap, true)).toBe(LN);
    });

    test("falls back to swap.assetSend when there's no bridge or pre-DEX", () => {
        const swap = makeSwap({ assetSend: LBTC });
        expect(getFinalAssetSend(swap)).toBe(LBTC);
    });

    test("returns sourceAsset for commitment swaps", () => {
        const route: SwapAssetRoute = {
            type: SwapType.Commitment,
            assetSend: USDT0,
            assetReceive: BTC,
            sourceAsset: "USDT0-ETH",
        };
        expect(getFinalAssetSend(route)).toBe("USDT0-ETH");
    });

    test("falls back to assetSend for commitment routes without sourceAsset", () => {
        const route: SwapAssetRoute = {
            type: SwapType.Commitment,
            assetSend: USDT0,
            assetReceive: BTC,
        };
        expect(getFinalAssetSend(route)).toBe(USDT0);
    });
});

describe("getFinalAssetReceive", () => {
    test("returns bridge.destinationAsset when a post-bridge is attached", () => {
        const swap = makeSwap({
            assetReceive: USDT0,
            bridge: makeBridge(USDT0, "USDT0-POL", SwapPosition.Post),
        });
        expect(getFinalAssetReceive(swap)).toBe("USDT0-POL");
    });

    test("ignores a pre-bridge and falls through to dex/assetReceive", () => {
        const swap = makeSwap({
            assetReceive: BTC,
            bridge: makeBridge("USDT0-ETH", USDT0, SwapPosition.Pre),
        });
        expect(getFinalAssetReceive(swap)).toBe(BTC);
    });

    test("returns the last DEX hop's `to` for post-DEX-hop swaps", () => {
        const swap = makeSwap({
            assetReceive: USDT0,
            dex: {
                hops: [
                    {
                        type: SwapType.Dex,
                        from: USDT0,
                        to: "TBTC",
                    },
                ],
                position: SwapPosition.Post,
                quoteAmount: 0,
            },
        });
        expect(getFinalAssetReceive(swap)).toBe("TBTC");
    });

    test("coalesces to LN for submarine swaps when requested", () => {
        const swap = makeSwap({
            type: SwapType.Submarine,
            assetReceive: LN,
        });
        expect(getFinalAssetReceive(swap, true)).toBe(LN);
    });

    test("falls back to swap.assetReceive when there's no bridge or post-DEX", () => {
        const swap = makeSwap({ assetReceive: LBTC });
        expect(getFinalAssetReceive(swap)).toBe(LBTC);
    });

    test("returns initialReceiveAsset for commitment swaps", () => {
        const route: SwapAssetRoute = {
            type: SwapType.Commitment,
            assetSend: USDT0,
            assetReceive: BTC,
            initialReceiveAsset: LBTC,
        };
        expect(getFinalAssetReceive(route)).toBe(LBTC);
    });

    test("falls back to assetReceive for commitment routes without initialReceiveAsset", () => {
        const route: SwapAssetRoute = {
            type: SwapType.Commitment,
            assetSend: USDT0,
            assetReceive: BTC,
        };
        expect(getFinalAssetReceive(route)).toBe(BTC);
    });
});
