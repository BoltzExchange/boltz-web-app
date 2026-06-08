import { hex } from "@scure/base";
import { type BridgeKind, SwapPosition } from "boltz-swaps/types";

import type { EncodedHop } from "./Pair";
import type { BridgeDetail } from "./swapCreator";

export type SwapMetadataPayload = {
    hops?: EncodedHop[];
    position?: SwapPosition;
    quoteAmount?: number | string;
    bridge?: {
        sourceAsset: string;
        destinationAsset: string;
        kind: BridgeKind;
        position: SwapPosition;
    };
};

export type SwapMetadataLocalFields = {
    dex?: {
        hops: EncodedHop[];
        position: SwapPosition;
        quoteAmount: number | string;
    };
    bridge?: BridgeDetail;
};

const IV_LENGTH = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBufferSource = (view: Uint8Array): Uint8Array<ArrayBuffer> =>
    new Uint8Array(view);

const deriveAesKey = async (mnemonic: string): Promise<CryptoKey> => {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        toBufferSource(textEncoder.encode(mnemonic.normalize("NFKD"))),
        "HKDF",
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(0),
            info: new Uint8Array(0),
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
};

export const encryptSwapMetadata = async (
    mnemonic: string,
    payload: SwapMetadataPayload,
): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveAesKey(mnemonic);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: toBufferSource(iv) },
            key,
            toBufferSource(textEncoder.encode(JSON.stringify(payload))),
        ),
    );

    const envelope = new Uint8Array(IV_LENGTH + ciphertext.length);
    envelope.set(iv, 0);
    envelope.set(ciphertext, IV_LENGTH);

    return hex.encode(envelope);
};

export const decryptSwapMetadata = async (
    mnemonic: string,
    metadata: string,
): Promise<SwapMetadataPayload> => {
    const envelope = hex.decode(metadata);

    if (envelope.length <= IV_LENGTH) {
        throw new Error("swap metadata envelope is too short");
    }

    const iv = envelope.slice(0, IV_LENGTH);
    const ciphertext = envelope.slice(IV_LENGTH);
    const key = await deriveAesKey(mnemonic);

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: toBufferSource(iv) },
        key,
        toBufferSource(ciphertext),
    );

    return JSON.parse(textDecoder.decode(plaintext)) as SwapMetadataPayload;
};

// Builds the payload from the same data used for local storage. Returns
// undefined when the swap is direct (no client-side DEX hops and no bridge), in
// which case no metadata should be sent.
export const buildSwapMetadataPayload = ({
    hops,
    hopsPosition,
    bridge,
    sendAmount,
    receiveAmount,
}: {
    hops: EncodedHop[];
    hopsPosition: SwapPosition | undefined;
    bridge: BridgeDetail | undefined;
    sendAmount: number;
    receiveAmount: number;
}): SwapMetadataPayload | undefined => {
    if (hopsPosition === undefined && bridge === undefined) {
        return undefined;
    }

    const payload: SwapMetadataPayload = {};

    if (hopsPosition !== undefined) {
        payload.hops = hops;
        payload.position = hopsPosition;
        payload.quoteAmount =
            hopsPosition === SwapPosition.Post ? receiveAmount : sendAmount;
    }

    if (bridge !== undefined) {
        payload.bridge = {
            sourceAsset: bridge.sourceAsset,
            destinationAsset: bridge.destinationAsset,
            kind: bridge.kind,
            position: bridge.position,
        };
    }

    return payload;
};

// Converts a decrypted payload back into the local swap fields. Used during
// restore to repopulate DEX/bridge routes the backend does not store.
export const swapMetadataToLocalFields = (
    payload: SwapMetadataPayload,
): SwapMetadataLocalFields => {
    const fields: SwapMetadataLocalFields = {};

    if (payload.position !== undefined && payload.hops !== undefined) {
        fields.dex = {
            hops: payload.hops,
            position: payload.position,
            quoteAmount: payload.quoteAmount ?? 0,
        };
    }

    if (payload.bridge !== undefined) {
        fields.bridge = {
            sourceAsset: payload.bridge.sourceAsset,
            destinationAsset: payload.bridge.destinationAsset,
            kind: payload.bridge.kind,
            position: payload.bridge.position,
        };
    }

    return fields;
};
