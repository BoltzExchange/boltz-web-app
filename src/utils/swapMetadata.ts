import { hex } from "@scure/base";
import { patchSwapMetadata } from "boltz-swaps/client";
import { BridgeKind, SwapPosition } from "boltz-swaps/types";
import log from "loglevel";

import type { EncodedHop } from "./Pair";
import type { RescueFile } from "./rescueFile";
import type {
    BridgeDetail,
    DexDetail,
    SomeSwap,
    SwapBase,
} from "./swapCreator";

type SwapMetadataBridge = Pick<
    BridgeDetail,
    "sourceAsset" | "destinationAsset" | "kind" | "position"
>;

export type SwapMetadataPayload = Pick<
    SwapBase,
    "lockupTx" | "commitmentLockupTxHash"
> & {
    dex?: DexDetail;
    bridge?: SwapMetadataBridge;
};

const IV_LENGTH = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const topLevelMetadataKeys = new Set([
    "dex",
    "bridge",
    "lockupTx",
    "commitmentLockupTxHash",
]);
const dexMetadataKeys = new Set(["hops", "position", "quoteAmount"]);
const bridgeMetadataKeys = new Set([
    "sourceAsset",
    "destinationAsset",
    "kind",
    "position",
]);

const toBufferSource = (view: Uint8Array): Uint8Array<ArrayBuffer> =>
    new Uint8Array(view);

const assertObject = (
    value: unknown,
    context: string,
): Record<string, unknown> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${context} must be an object`);
    }

    return value as Record<string, unknown>;
};

const assertKnownKeys = (
    object: Record<string, unknown>,
    keys: Set<string>,
    context: string,
) => {
    const unknownKey = Object.keys(object).find((key) => !keys.has(key));
    if (unknownKey !== undefined) {
        throw new Error(`${context} contains unknown field ${unknownKey}`);
    }
};

const readString = (
    object: Record<string, unknown>,
    key: string,
    context: string,
): string => {
    const value = object[key];
    if (typeof value !== "string") {
        throw new Error(`${context}.${key} must be a string`);
    }

    return value;
};

const isSwapPosition = (value: unknown): value is SwapPosition =>
    value === SwapPosition.Pre || value === SwapPosition.Post;

const readSwapPosition = (
    object: Record<string, unknown>,
    key: string,
    context: string,
): SwapPosition => {
    const value = object[key];
    if (!isSwapPosition(value)) {
        throw new Error(`${context}.${key} must be a swap position`);
    }

    return value;
};

const parseDexMetadata = (value: unknown): DexDetail => {
    const object = assertObject(value, "swap metadata dex");
    assertKnownKeys(object, dexMetadataKeys, "swap metadata dex");

    if (!Array.isArray(object.hops)) {
        throw new Error("swap metadata dex.hops must be an array");
    }

    const quoteAmount = object.quoteAmount;
    if (typeof quoteAmount !== "number" && typeof quoteAmount !== "string") {
        throw new Error(
            "swap metadata dex.quoteAmount must be a number or string",
        );
    }

    return {
        hops: object.hops as EncodedHop[],
        position: readSwapPosition(object, "position", "swap metadata dex"),
        quoteAmount,
    };
};

const parseBridgeMetadata = (value: unknown): SwapMetadataBridge => {
    const object = assertObject(value, "swap metadata bridge");
    assertKnownKeys(object, bridgeMetadataKeys, "swap metadata bridge");

    const kind = object.kind;
    if (!Object.values(BridgeKind).includes(kind as BridgeKind)) {
        throw new Error("swap metadata bridge.kind must be a bridge kind");
    }

    return {
        sourceAsset: readString(object, "sourceAsset", "swap metadata bridge"),
        destinationAsset: readString(
            object,
            "destinationAsset",
            "swap metadata bridge",
        ),
        kind: kind as BridgeKind,
        position: readSwapPosition(object, "position", "swap metadata bridge"),
    };
};

const parseSwapMetadataPayload = (value: unknown): SwapMetadataPayload => {
    const object = assertObject(value, "swap metadata");
    assertKnownKeys(object, topLevelMetadataKeys, "swap metadata");

    const payload: SwapMetadataPayload = {};

    if (object.dex !== undefined) {
        payload.dex = parseDexMetadata(object.dex);
    }

    if (object.bridge !== undefined) {
        payload.bridge = parseBridgeMetadata(object.bridge);
    }

    if (object.lockupTx !== undefined) {
        payload.lockupTx = readString(object, "lockupTx", "swap metadata");
    }

    if (object.commitmentLockupTxHash !== undefined) {
        payload.commitmentLockupTxHash = readString(
            object,
            "commitmentLockupTxHash",
            "swap metadata",
        );
    }

    return payload;
};

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

    return parseSwapMetadataPayload(JSON.parse(textDecoder.decode(plaintext)));
};

export const buildSwapMetadataPayloadFromSwap = (
    swap: SomeSwap,
): SwapMetadataPayload | undefined => {
    const payload: SwapMetadataPayload = {};

    if (swap.dex !== undefined) {
        payload.dex = swap.dex;
    }

    if (swap.bridge !== undefined) {
        payload.bridge = {
            sourceAsset: swap.bridge.sourceAsset,
            destinationAsset: swap.bridge.destinationAsset,
            kind: swap.bridge.kind,
            position: swap.bridge.position,
        };
    }

    if (swap.lockupTx !== undefined) {
        payload.lockupTx = swap.lockupTx;
    }

    if (swap.commitmentLockupTxHash !== undefined) {
        payload.commitmentLockupTxHash = swap.commitmentLockupTxHash;
    }

    return Object.keys(payload).length > 0 ? payload : undefined;
};

const hasMetadataTxIdentity = (payload: SwapMetadataPayload): boolean =>
    payload.lockupTx !== undefined ||
    payload.commitmentLockupTxHash !== undefined;

const hasRouteMetadata = (payload: SwapMetadataPayload): boolean =>
    payload.dex !== undefined || payload.bridge !== undefined;

export const patchEncryptedSwapMetadata = async (
    swap: SomeSwap,
    rescueFile: RescueFile | null | undefined,
) => {
    const payload = buildSwapMetadataPayloadFromSwap(swap);
    if (
        payload === undefined ||
        !hasRouteMetadata(payload) ||
        !hasMetadataTxIdentity(payload)
    ) {
        return;
    }

    const mnemonic = rescueFile?.mnemonic;
    if (mnemonic === undefined || mnemonic === "") {
        log.warn("Cannot patch swap metadata without rescue file", {
            swapId: swap.id,
        });
        return;
    }

    try {
        await patchSwapMetadata(
            swap.id,
            await encryptSwapMetadata(mnemonic, payload),
        );
    } catch (error) {
        log.warn("Failed to patch swap metadata", {
            swapId: swap.id,
            error,
        });
    }
};
