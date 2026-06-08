import { BigNumber } from "bignumber.js";
import { BridgeKind, SwapPosition, SwapType } from "boltz-swaps/types";

import type * as ClientModule from "../../packages/boltz-swaps/src/client";
import { BTC, LBTC, LN, USDT0 } from "../../src/consts/Assets";
import type { newKeyFn } from "../../src/context/Global";
import type { RescueFile } from "../../src/utils/rescueFile";
import {
    type BridgeDetail,
    type SwapBase,
    createChain,
    createReverse,
    createSubmarine,
    getFinalAssetReceive,
    getFinalAssetSend,
    getPostBridgeDetail,
    getPreBridgeDetail,
    noGasAbstraction,
} from "../../src/utils/swapCreator";

const { createSubmarineMock, createReverseMock, createChainMock } = vi.hoisted(
    () => ({
        createSubmarineMock: vi.fn(),
        createReverseMock: vi.fn(),
        createChainMock: vi.fn(),
    }),
);

vi.mock("boltz-swaps/client", async (importActual) => ({
    ...(await importActual<typeof ClientModule>()),
    createSubmarineSwap: createSubmarineMock,
    createReverseSwap: createReverseMock,
    createChainSwap: createChainMock,
}));

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
});

describe("create wrappers forward metadata to the client", () => {
    const rescueFile: RescueFile = {
        mnemonic:
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    };

    const newKeyWithIndex: newKeyFn = vi.fn().mockResolvedValue({
        key: { publicKey: new Uint8Array(33) },
        index: 0,
    });
    const newKeyNone: newKeyFn = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        createSubmarineMock.mockReset().mockResolvedValue({ id: "sub" });
        createReverseMock.mockReset().mockResolvedValue({ id: "rev" });
        createChainMock.mockReset().mockResolvedValue({ id: "chain" });
    });

    test("createSubmarine forwards metadata", async () => {
        await createSubmarine(
            BTC,
            BTC,
            BigNumber(1000),
            BigNumber(900),
            "lninvoice",
            "pair-hash",
            noGasAbstraction(),
            newKeyNone,
            undefined,
            "encrypted-metadata",
        );

        expect(createSubmarineMock).toHaveBeenCalledTimes(1);
        // metadata is the 6th positional argument
        expect(createSubmarineMock.mock.calls[0][5]).toBe("encrypted-metadata");
    });

    test("createReverse forwards metadata", async () => {
        await createReverse(
            LN,
            BTC,
            BigNumber(1000),
            BigNumber(900),
            "bc1qclaim",
            "pair-hash",
            noGasAbstraction(),
            rescueFile,
            newKeyWithIndex,
            undefined,
            "encrypted-metadata",
        );

        expect(createReverseMock).toHaveBeenCalledTimes(1);
        // metadata is the 8th positional argument
        expect(createReverseMock.mock.calls[0][7]).toBe("encrypted-metadata");
    });

    test("createChain forwards metadata", async () => {
        await createChain(
            BTC,
            BTC,
            BigNumber(1000),
            BigNumber(900),
            "bc1qclaim",
            "pair-hash",
            noGasAbstraction(),
            rescueFile,
            newKeyWithIndex,
            undefined,
            "encrypted-metadata",
        );

        expect(createChainMock).toHaveBeenCalledTimes(1);
        // metadata is the 9th positional argument
        expect(createChainMock.mock.calls[0][8]).toBe("encrypted-metadata");
    });

    test("omits metadata when not provided", async () => {
        await createSubmarine(
            BTC,
            BTC,
            BigNumber(1000),
            BigNumber(900),
            "lninvoice",
            "pair-hash",
            noGasAbstraction(),
            newKeyNone,
        );

        expect(createSubmarineMock.mock.calls[0][5]).toBeUndefined();
    });
});
