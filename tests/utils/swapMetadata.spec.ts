import { hex } from "@scure/base";
import { BridgeKind, SwapPosition, SwapType } from "boltz-swaps/types";

import type { BridgeDetail } from "../../src/utils/swapCreator";
import {
    type SwapMetadataPayload,
    appendCommitmentMatchMarker,
    buildSwapMetadataPayload,
    createCommitmentMatchId,
    decryptSwapMetadata,
    encryptSwapMetadata,
    extractCommitmentMatchIdFromInput,
    normalizeCommitmentMatchId,
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

describe("commitment match metadata", () => {
    test("creates and normalizes 32-byte hex IDs", () => {
        const id = createCommitmentMatchId();

        expect(id).toMatch(/^[0-9a-f]{64}$/);
        expect(normalizeCommitmentMatchId(`0x${id.toUpperCase()}`)).toBe(id);
        expect(normalizeCommitmentMatchId("not-hex")).toBeUndefined();
    });

    test("appends and extracts calldata markers", () => {
        const id =
            "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const input = appendCommitmentMatchMarker("0xabcdef", id);

        expect(input.startsWith("0xabcdef")).toBe(true);
        expect(extractCommitmentMatchIdFromInput(input)).toBe(id);
        expect(extractCommitmentMatchIdFromInput("0xabcdef")).toBeUndefined();
    });
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
            bridge: {
                ...makeBridge(SwapPosition.Pre),
                refundAddress: "source-wallet",
            },
            sendAmount: 1000,
            receiveAmount: 900,
        });
        expect(payload).toEqual({
            bridge: {
                sourceAsset: "USDC",
                destinationAsset: "USDC-BASE",
                kind: BridgeKind.Cctp,
                position: SwapPosition.Pre,
                refundAddress: "source-wallet",
            },
        });
    });

    test("includes commitment match metadata without requiring a route", () => {
        const id =
            "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const payload = buildSwapMetadataPayload({
            hops: [],
            hopsPosition: undefined,
            bridge: undefined,
            sendAmount: 1000,
            receiveAmount: 900,
            commitmentMatch: { version: 1, id },
        });

        expect(payload).toEqual({
            commitmentMatch: { version: 1, id },
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

describe("swapMetadataToLocalFields", () => {
    test("maps a full payload to dex and bridge fields", () => {
        const commitmentMatch = {
            version: 1 as const,
            id: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        };

        expect(
            swapMetadataToLocalFields({
                ...samplePayload,
                bridge: {
                    ...samplePayload.bridge!,
                    refundAddress: "source-wallet",
                },
                commitmentMatch,
            }),
        ).toEqual({
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
                refundAddress: "source-wallet",
            },
            commitmentMatch,
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
