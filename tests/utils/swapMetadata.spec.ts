import { hex } from "@scure/base";
import { BridgeKind, SwapPosition, SwapType } from "boltz-swaps/types";

import type { BridgeDetail } from "../../src/utils/swapCreator";
import {
    type SwapMetadataPayload,
    buildSwapMetadataPayload,
    buildSwapMetadataPayloadFromSwap,
    decryptSwapMetadata,
    encryptSwapMetadata,
    swapMetadataToLocalFields,
} from "../../src/utils/swapMetadata";

const mnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const otherMnemonic =
    "legal winner thank year wave sausage worth useful legal winner thank yellow";

// Matches the backend's metadata format (hex).
const backendMetadataRegex = /^(?:[0-9a-fA-F]{2})+$/;

const samplePayload: SwapMetadataPayload = {
    hops: [{ type: SwapType.Dex, from: "TBTC", to: "WBTC" }],
    position: SwapPosition.Post,
    quoteAmount: 12345,
    lockupTx: "0xlockup",
    commitmentLockupTxHash: "0xcommitment",
    bridge: {
        sourceAsset: "USDC",
        destinationAsset: "USDC-BASE",
        kind: BridgeKind.Cctp,
        position: SwapPosition.Post,
    },
};

describe("swapMetadata crypto", () => {
    test("round-trips a payload through encrypt/decrypt", async () => {
        const metadata = await encryptSwapMetadata(mnemonic, samplePayload);
        expect(typeof metadata).toBe("string");

        const decrypted = await decryptSwapMetadata(mnemonic, metadata);
        expect(decrypted).toEqual(samplePayload);
    });

    test("encodes the envelope as backend-compatible hex", async () => {
        const metadata = await encryptSwapMetadata(mnemonic, samplePayload);
        expect(metadata).toMatch(backendMetadataRegex);
        expect(metadata).toBe(metadata.toLowerCase());
    });

    test("produces a different ciphertext each time (random IV)", async () => {
        const first = await encryptSwapMetadata(mnemonic, samplePayload);
        const second = await encryptSwapMetadata(mnemonic, samplePayload);
        expect(first).not.toBe(second);
    });

    test("fails to decrypt with the wrong mnemonic", async () => {
        const metadata = await encryptSwapMetadata(mnemonic, samplePayload);
        await expect(
            decryptSwapMetadata(otherMnemonic, metadata),
        ).rejects.toBeDefined();
    });

    test("rejects an envelope that is too short", async () => {
        const tooShort = hex.encode(new Uint8Array(12));
        await expect(decryptSwapMetadata(mnemonic, tooShort)).rejects.toThrow(
            /too short/,
        );
    });
});

const makeBridge = (position: SwapPosition): BridgeDetail => ({
    kind: BridgeKind.Cctp,
    sourceAsset: "USDC",
    destinationAsset: "USDC-BASE",
    position,
});

describe("buildSwapMetadataPayload", () => {
    test("returns undefined for a direct pair with no DEX or bridge", () => {
        expect(
            buildSwapMetadataPayload({
                hops: [],
                hopsPosition: undefined,
                bridge: undefined,
                sendAmount: 1000,
                receiveAmount: 900,
            }),
        ).toBeUndefined();
    });

    test("includes hops/position/quoteAmount from sendAmount for pre-DEX", () => {
        const payload = buildSwapMetadataPayload({
            hops: [{ type: SwapType.Dex, from: "WBTC", to: "TBTC" }],
            hopsPosition: SwapPosition.Pre,
            bridge: undefined,
            sendAmount: 1000,
            receiveAmount: 900,
        });
        expect(payload).toEqual({
            hops: [{ type: SwapType.Dex, from: "WBTC", to: "TBTC" }],
            position: SwapPosition.Pre,
            quoteAmount: 1000,
        });
    });

    test("uses receiveAmount as quoteAmount for post-DEX", () => {
        const payload = buildSwapMetadataPayload({
            hops: [{ type: SwapType.Dex, from: "TBTC", to: "WBTC" }],
            hopsPosition: SwapPosition.Post,
            bridge: undefined,
            sendAmount: 1000,
            receiveAmount: 900,
        });
        expect(payload?.quoteAmount).toBe(900);
        expect(payload?.bridge).toBeUndefined();
    });

    test("includes only the bridge when there is no DEX route", () => {
        const payload = buildSwapMetadataPayload({
            hops: [],
            hopsPosition: undefined,
            bridge: makeBridge(SwapPosition.Pre),
            sendAmount: 1000,
            receiveAmount: 900,
        });
        expect(payload).toEqual({
            bridge: {
                sourceAsset: "USDC",
                destinationAsset: "USDC-BASE",
                kind: BridgeKind.Cctp,
                position: SwapPosition.Pre,
            },
        });
    });

    test("combines DEX and bridge into a single payload", () => {
        const payload = buildSwapMetadataPayload({
            hops: [{ type: SwapType.Dex, from: "TBTC", to: "USDC" }],
            hopsPosition: SwapPosition.Post,
            bridge: makeBridge(SwapPosition.Post),
            sendAmount: 1000,
            receiveAmount: 900,
        });
        expect(payload?.hops).toBeDefined();
        expect(payload?.bridge).toBeDefined();
    });
});

describe("buildSwapMetadataPayloadFromSwap", () => {
    test("can build metadata with only tx identity", () => {
        expect(
            buildSwapMetadataPayloadFromSwap({
                type: SwapType.Submarine,
                id: "swap-id",
                lockupTx: "0xtx",
            } as never),
        ).toEqual({ lockupTx: "0xtx" });
    });
});

describe("swapMetadataToLocalFields", () => {
    test("maps a full payload to dex and bridge fields", () => {
        expect(swapMetadataToLocalFields(samplePayload)).toEqual({
            dex: {
                hops: samplePayload.hops,
                position: SwapPosition.Post,
                quoteAmount: 12345,
            },
            bridge: {
                sourceAsset: "USDC",
                destinationAsset: "USDC-BASE",
                kind: BridgeKind.Cctp,
                position: SwapPosition.Post,
            },
            lockupTx: "0xlockup",
            commitmentLockupTxHash: "0xcommitment",
        });
    });

    test("omits dex when there are no hops", () => {
        expect(
            swapMetadataToLocalFields({
                bridge: {
                    sourceAsset: "USDC",
                    destinationAsset: "USDC-BASE",
                    kind: BridgeKind.Cctp,
                    position: SwapPosition.Pre,
                },
            }),
        ).toEqual({
            bridge: {
                sourceAsset: "USDC",
                destinationAsset: "USDC-BASE",
                kind: BridgeKind.Cctp,
                position: SwapPosition.Pre,
            },
        });
    });
});
