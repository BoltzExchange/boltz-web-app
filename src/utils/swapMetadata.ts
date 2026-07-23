import { hex } from "@scure/base";
import { type RestorableSwap, patchSwapMetadata } from "boltz-swaps/client";
import { BridgeKind, SwapPosition, SwapType } from "boltz-swaps/types";
import log from "loglevel";

import type { EncodedHop } from "./Pair";
import { formatError } from "./errors";
import type { RescueFile } from "./rescueFile";
import {
    type BridgeDetail,
    type DexDetail,
    type SomeSwap,
    type SwapBase,
    isCommitmentSwap,
} from "./swapCreator";

type SwapMetadataBridge = Pick<
    BridgeDetail,
    "sourceAsset" | "destinationAsset" | "kind" | "position" | "refundAddress"
>;
type SwapMetadataDex = Pick<DexDetail, "hops" | "position" | "quoteAmount">;
type SwapMetadataTxIdentity = Pick<
    SwapBase,
    "lockupTx" | "commitmentLockupTxHash" | "originalDestination"
>;
type SwapMetadataDexDetails = NonNullable<EncodedHop["dexDetails"]>;
type SwapMetadataRoute = {
    dex?: SwapMetadataDex;
    bridge?: SwapMetadataBridge;
};
export type SwapMetadataSource = SwapMetadataTxIdentity & {
    dex?: DexDetail;
    bridge?: BridgeDetail;
};

export type SwapMetadataPayload = SwapMetadataTxIdentity & SwapMetadataRoute;
export type SwapMetadataLocalFields = Pick<
    SwapMetadataPayload,
    | "dex"
    | "bridge"
    | "lockupTx"
    | "commitmentLockupTxHash"
    | "originalDestination"
>;

// The payload plus the id of the swap it belongs to, sealed in so that
// the backend cannot serve one swap's metadata for another. Optional only
// because the creation flow encrypts before the backend assigns an id;
// payloads carrying a lockup transaction must always be bound
type SwapMetadataPlaintext = SwapMetadataPayload & {
    swapId?: string;
};

const IV_LENGTH = 12;

// Major version of the plaintext schema, independent of the crypto envelope
// version in deriveAesKey's HKDF info. Additive fields keep this major and are
// ignored by older readers (parseObject drops unknown keys); a breaking or
// security-relevant change must bump the major so older readers reject the blob
// in assertSupportedVersion instead of silently mis-reading it.
const SWAP_METADATA_VERSION = 1;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBufferSource = (view: Uint8Array): Uint8Array<ArrayBuffer> =>
    new Uint8Array(view);

type Parser<T> = (value: unknown, context: string) => T;

// A schema must provide a parser for every key of T, each returning that
// field's exact type. Adding, removing, renaming or retyping a field in the
// schema types breaks compilation here, so parsers cannot drift silently.
type Schema<T> = { [K in keyof Required<T>]: Parser<T[K]> };

const parseString: Parser<string> = (value, context) => {
    if (typeof value !== "string") {
        throw new Error(`${context} must be a string`);
    }

    return value;
};

const parseNumberOrString: Parser<number | string> = (value, context) => {
    if (typeof value !== "number" && typeof value !== "string") {
        throw new Error(`${context} must be a number or string`);
    }

    return value;
};

const parseEnum = <T extends Record<string, string>>(
    values: T,
): Parser<T[keyof T]> => {
    const members = Object.values(values);

    return (value, context) => {
        if (!members.includes(value as string)) {
            throw new Error(`${context} must be one of ${members.join(", ")}`);
        }

        return value as T[keyof T];
    };
};

const parseOptional =
    <T>(parser: Parser<T>): Parser<T | undefined> =>
    (value, context) =>
        value === undefined ? undefined : parser(value, context);

const parseArray =
    <T>(parser: Parser<T>): Parser<T[]> =>
    (value, context) => {
        if (!Array.isArray(value)) {
            throw new Error(`${context} must be an array`);
        }

        return value.map((item, index) => parser(item, `${context}[${index}]`));
    };

const parseObject =
    <T>(schema: Schema<T>): Parser<T> =>
    (value, context) => {
        if (
            typeof value !== "object" ||
            value === null ||
            Array.isArray(value)
        ) {
            throw new Error(`${context} must be an object`);
        }
        const record = value as Record<string, unknown>;

        // Unknown keys are ignored, not rejected: a newer app version may add
        // fields within the same major, and the payload is authenticated, so
        // extra keys can only come from our own newer writer, never a backend.
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(schema)) {
            const parse = (schema as Record<string, Parser<unknown>>)[key];
            const parsed = parse(record[key], `${context}.${key}`);
            if (parsed !== undefined) {
                result[key] = parsed;
            }
        }

        return result as T;
    };

const swapHopTypes = {
    Submarine: SwapType.Submarine,
    Reverse: SwapType.Reverse,
    Chain: SwapType.Chain,
    Dex: SwapType.Dex,
} as const;

const parseHopMetadata = parseObject<EncodedHop>({
    type: parseEnum(swapHopTypes),
    from: parseString,
    to: parseString,
    dexDetails: parseOptional(
        parseObject<SwapMetadataDexDetails>({
            chain: parseString,
            tokenIn: parseString,
            tokenOut: parseString,
        }),
    ),
});

const parseSwapMetadataPlaintext = parseObject<SwapMetadataPlaintext>({
    dex: parseOptional(
        parseObject<SwapMetadataDex>({
            hops: parseArray(parseHopMetadata),
            position: parseEnum(SwapPosition),
            quoteAmount: parseNumberOrString,
        }),
    ),
    bridge: parseOptional(
        parseObject<SwapMetadataBridge>({
            sourceAsset: parseString,
            destinationAsset: parseString,
            kind: parseEnum(BridgeKind),
            position: parseEnum(SwapPosition),
            refundAddress: parseOptional(parseString),
        }),
    ),
    lockupTx: parseOptional(parseString),
    commitmentLockupTxHash: parseOptional(parseString),
    originalDestination: parseOptional(parseString),
    swapId: parseOptional(parseString),
});

const hasMetadataTxIdentity = (payload: SwapMetadataPayload): boolean =>
    payload.lockupTx !== undefined ||
    payload.commitmentLockupTxHash !== undefined;

const hasRouteMetadata = (payload: SwapMetadataPayload): boolean =>
    payload.dex !== undefined || payload.bridge !== undefined;

const assertSupportedVersion = (value: unknown): void => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("swap metadata must be an object");
    }

    const version = (value as Record<string, unknown>).version;
    if (version !== SWAP_METADATA_VERSION) {
        throw new Error(
            `unsupported swap metadata version: ${String(version)}`,
        );
    }
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
            info: toBufferSource(textEncoder.encode("swapMetadata/aes-gcm/v1")),
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
};

export const encryptSwapMetadata = async (
    mnemonic: string,
    payload: SwapMetadataPlaintext,
): Promise<string> => {
    if (payload.swapId === undefined && hasMetadataTxIdentity(payload)) {
        throw new Error(
            "swap metadata with a lockup transaction must be bound to a swap",
        );
    }

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveAesKey(mnemonic);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: toBufferSource(iv) },
            key,
            toBufferSource(
                textEncoder.encode(
                    JSON.stringify({
                        ...payload,
                        version: SWAP_METADATA_VERSION,
                    }),
                ),
            ),
        ),
    );

    const envelope = new Uint8Array(IV_LENGTH + ciphertext.length);
    envelope.set(iv, 0);
    envelope.set(ciphertext, IV_LENGTH);

    return hex.encode(envelope);
};

export const decryptSwapMetadata = async (
    mnemonic: string,
    swapId: string,
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

    const parsed: unknown = JSON.parse(textDecoder.decode(plaintext));
    assertSupportedVersion(parsed);

    const { swapId: boundSwapId, ...payload } = parseSwapMetadataPlaintext(
        parsed,
        "swap metadata",
    );

    if (boundSwapId !== undefined && boundSwapId !== swapId) {
        throw new Error("swap metadata is bound to a different swap");
    }

    if (boundSwapId === undefined && hasMetadataTxIdentity(payload)) {
        throw new Error(
            "swap metadata with a lockup transaction must be bound to a swap",
        );
    }

    return payload;
};

export const buildSwapMetadataPayload = (
    fields: SwapMetadataSource,
): SwapMetadataPayload | undefined => {
    const payload: SwapMetadataPayload = {};

    if (fields.dex !== undefined) {
        payload.dex = {
            hops: fields.dex.hops,
            position: fields.dex.position,
            quoteAmount: fields.dex.quoteAmount,
        };
    }

    if (fields.bridge !== undefined) {
        payload.bridge = {
            sourceAsset: fields.bridge.sourceAsset,
            destinationAsset: fields.bridge.destinationAsset,
            kind: fields.bridge.kind,
            position: fields.bridge.position,
            refundAddress: fields.bridge.refundAddress,
        };
    }

    if (fields.lockupTx !== undefined) {
        payload.lockupTx = fields.lockupTx;
    }

    if (fields.commitmentLockupTxHash !== undefined) {
        payload.commitmentLockupTxHash = fields.commitmentLockupTxHash;
    }

    if (fields.originalDestination !== undefined) {
        payload.originalDestination = fields.originalDestination;
    }

    return Object.keys(payload).length > 0 ? payload : undefined;
};

export const buildSwapMetadataPayloadFromSwap = (
    swap: SomeSwap,
): SwapMetadataPayload | undefined =>
    buildSwapMetadataPayload({
        bridge: swap.bridge,
        commitmentLockupTxHash: swap.commitmentLockupTxHash,
        dex: swap.dex,
        lockupTx: swap.lockupTx,
        originalDestination: swap.originalDestination,
    });

export const patchEncryptedSwapMetadata = async (
    swap: SomeSwap,
    rescueFile: RescueFile | null | undefined,
) => {
    if (isCommitmentSwap(swap)) {
        return;
    }

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
            await encryptSwapMetadata(mnemonic, {
                ...payload,
                swapId: swap.id,
            }),
        );
    } catch (error) {
        log.warn("Failed to patch swap metadata", {
            swapId: swap.id,
            error,
        });
    }
};

export const swapMetadataToLocalFields = (
    payload: SwapMetadataPayload,
): SwapMetadataLocalFields => {
    const fields: SwapMetadataLocalFields = {};

    if (payload.dex !== undefined) {
        fields.dex = payload.dex;
    }

    if (payload.bridge !== undefined) {
        fields.bridge = payload.bridge;
    }

    if (payload.lockupTx !== undefined) {
        fields.lockupTx = payload.lockupTx;
    }

    if (payload.commitmentLockupTxHash !== undefined) {
        fields.commitmentLockupTxHash = payload.commitmentLockupTxHash;
    }

    if (payload.originalDestination !== undefined) {
        fields.originalDestination = payload.originalDestination;
    }

    return fields;
};

export const hydrateRestorableSwapMetadata = async <T extends RestorableSwap>(
    swap: T,
    mnemonic: string,
): Promise<T & SwapMetadataLocalFields> => {
    if (swap.metadata === undefined) {
        return swap;
    }

    try {
        return {
            ...swap,
            ...swapMetadataToLocalFields(
                await decryptSwapMetadata(mnemonic, swap.id, swap.metadata),
            ),
        };
    } catch (e) {
        log.warn(
            `failed to decrypt metadata for swap ${swap.id}, falling back to on-chain assets:`,
            formatError(e),
        );
        return swap;
    }
};

export const hydrateRestorableSwapsMetadata = <T extends RestorableSwap>(
    swaps: T[],
    mnemonic: string,
): Promise<(T & SwapMetadataLocalFields)[]> =>
    Promise.all(
        swaps.map((swap) => hydrateRestorableSwapMetadata(swap, mnemonic)),
    );
