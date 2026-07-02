import { hex } from "@scure/base";
import { BridgeKind, SwapPosition, SwapType } from "boltz-swaps/types";
import { beforeEach, vi } from "vitest";

import {
    type SwapMetadataPayload,
    buildSwapMetadataPayloadFromSwap,
    decryptSwapMetadata,
    encryptSwapMetadata,
    patchEncryptedSwapMetadata,
} from "../../src/utils/swapMetadata";

const mocks = vi.hoisted(() => ({
    patchSwapMetadata: vi.fn(),
}));

vi.mock("boltz-swaps/client", () => ({
    patchSwapMetadata: mocks.patchSwapMetadata,
}));

const mnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const otherMnemonic =
    "legal winner thank year wave sausage worth useful legal winner thank yellow";

// Matches the backend's metadata format (hex).
const backendMetadataRegex = /^(?:[0-9a-fA-F]{2})+$/;
const rescueFile = { mnemonic } as never;

const samplePayload: SwapMetadataPayload = {
    dex: {
        hops: [{ type: SwapType.Dex, from: "TBTC", to: "WBTC" }],
        position: SwapPosition.Post,
        quoteAmount: 12345,
    },
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

    test("rejects unexpected payload fields", async () => {
        const metadata = await encryptSwapMetadata(mnemonic, {
            ...samplePayload,
            unexpected: true,
        } as never);

        await expect(decryptSwapMetadata(mnemonic, metadata)).rejects.toThrow(
            /unknown field unexpected/,
        );
    });

    test("rejects malformed DEX metadata", async () => {
        const metadata = await encryptSwapMetadata(mnemonic, {
            dex: {
                hops: [],
                position: SwapPosition.Post,
            },
        } as never);

        await expect(decryptSwapMetadata(mnemonic, metadata)).rejects.toThrow(
            /quoteAmount/,
        );
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

describe("patchEncryptedSwapMetadata", () => {
    beforeEach(() => {
        mocks.patchSwapMetadata.mockReset();
    });

    test("patches routed metadata with tx identity", async () => {
        await patchEncryptedSwapMetadata(
            {
                type: SwapType.Submarine,
                id: "swap-id",
                lockupTx: "0xtx",
                dex: samplePayload.dex,
            } as never,
            rescueFile,
        );

        expect(mocks.patchSwapMetadata).toHaveBeenCalledOnce();
        const [swapId, metadata] = mocks.patchSwapMetadata.mock.calls[0];
        expect(swapId).toBe("swap-id");
        await expect(decryptSwapMetadata(mnemonic, metadata)).resolves.toEqual({
            lockupTx: "0xtx",
            dex: samplePayload.dex,
        });
    });

    test("does not patch tx identity without route metadata", async () => {
        await patchEncryptedSwapMetadata(
            {
                type: SwapType.Submarine,
                id: "swap-id",
                lockupTx: "0xtx",
            } as never,
            rescueFile,
        );

        expect(mocks.patchSwapMetadata).not.toHaveBeenCalled();
    });

    test("does not patch route metadata without tx identity", async () => {
        await patchEncryptedSwapMetadata(
            {
                type: SwapType.Submarine,
                id: "swap-id",
                dex: samplePayload.dex,
            } as never,
            rescueFile,
        );

        expect(mocks.patchSwapMetadata).not.toHaveBeenCalled();
    });
});
