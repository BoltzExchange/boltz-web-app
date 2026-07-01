import { hex } from "@scure/base";
import type { RestorableSwap } from "boltz-swaps/client";
import { type BridgeKind, SwapPosition } from "boltz-swaps/types";
import log from "loglevel";

import type { EncodedHop } from "./Pair";
import { formatError } from "./errors";
import type { BridgeDetail } from "./swapCreator";

export type CommitmentMatchMetadata = {
    version: 1;
    id: string;
};

export type SwapMetadataPayload = {
    hops?: EncodedHop[];
    position?: SwapPosition;
    quoteAmount?: number | string;
    bridge?: {
        sourceAsset: string;
        destinationAsset: string;
        kind: BridgeKind;
        position: SwapPosition;
        refundAddress?: string;
    };
    commitmentMatch?: CommitmentMatchMetadata;
};

export type SwapMetadataLocalFields = {
    dex?: {
        hops: EncodedHop[];
        position: SwapPosition;
        quoteAmount: number | string;
    };
    bridge?: BridgeDetail;
    commitmentMatch?: CommitmentMatchMetadata;
};

const IV_LENGTH = 12;
const COMMITMENT_MATCH_ID_BYTES = 32;
const COMMITMENT_MATCH_ID_HEX_LENGTH = COMMITMENT_MATCH_ID_BYTES * 2;
const COMMITMENT_MATCH_MARKER_PREFIX = hex.encode(
    new TextEncoder().encode("boltz_commitment_v1"),
);

const toBridgeMetadata = (bridge: {
    sourceAsset: string;
    destinationAsset: string;
    kind: BridgeKind;
    position: SwapPosition;
    refundAddress?: string;
}) => ({
    sourceAsset: bridge.sourceAsset,
    destinationAsset: bridge.destinationAsset,
    kind: bridge.kind,
    position: bridge.position,
    ...(bridge.refundAddress === undefined
        ? {}
        : { refundAddress: bridge.refundAddress }),
});

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBufferSource = (view: Uint8Array): Uint8Array<ArrayBuffer> =>
    new Uint8Array(view);

export const normalizeCommitmentMatchId = (
    id: string | undefined,
): string | undefined => {
    const normalized = id?.toLowerCase().replace(/^0x/, "");
    if (
        normalized === undefined ||
        normalized.length !== COMMITMENT_MATCH_ID_HEX_LENGTH ||
        !/^[0-9a-f]+$/.test(normalized)
    ) {
        return undefined;
    }

    return normalized;
};

export const createCommitmentMatchId = (): string => {
    const bytes = crypto.getRandomValues(
        new Uint8Array(COMMITMENT_MATCH_ID_BYTES),
    );
    return hex.encode(bytes);
};

const toCommitmentMatchMetadata = (
    commitmentMatch: CommitmentMatchMetadata | undefined,
): CommitmentMatchMetadata | undefined => {
    const id = normalizeCommitmentMatchId(commitmentMatch?.id);
    if (commitmentMatch?.version !== 1 || id === undefined) {
        return undefined;
    }

    return {
        version: 1,
        id,
    };
};

export const buildCommitmentMatchMarker = (id: string): `0x${string}` => {
    const normalized = normalizeCommitmentMatchId(id);
    if (normalized === undefined) {
        throw new Error("invalid commitment match id");
    }

    return `0x${COMMITMENT_MATCH_MARKER_PREFIX}${normalized}`;
};

export const appendCommitmentMatchMarker = <T extends `0x${string}`>(
    data: T,
    id: string | undefined,
): `0x${string}` => {
    if (id === undefined) {
        return data;
    }

    return `${data}${buildCommitmentMatchMarker(id).slice(2)}` as `0x${string}`;
};

export const extractCommitmentMatchIdFromInput = (
    input: string | undefined | null,
): string | undefined => {
    const normalized = input?.toLowerCase().replace(/^0x/, "") ?? "";
    const markerIndex = normalized.lastIndexOf(COMMITMENT_MATCH_MARKER_PREFIX);
    if (markerIndex === -1) {
        return undefined;
    }

    return normalizeCommitmentMatchId(
        normalized.slice(
            markerIndex + COMMITMENT_MATCH_MARKER_PREFIX.length,
            markerIndex +
                COMMITMENT_MATCH_MARKER_PREFIX.length +
                COMMITMENT_MATCH_ID_HEX_LENGTH,
        ),
    );
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
    commitmentMatch,
}: {
    hops: EncodedHop[];
    hopsPosition: SwapPosition | undefined;
    bridge: BridgeDetail | undefined;
    sendAmount: number;
    receiveAmount: number;
    commitmentMatch?: CommitmentMatchMetadata;
}): SwapMetadataPayload | undefined => {
    const normalizedCommitmentMatch =
        toCommitmentMatchMetadata(commitmentMatch);

    if (
        hopsPosition === undefined &&
        bridge === undefined &&
        normalizedCommitmentMatch === undefined
    ) {
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
        payload.bridge = toBridgeMetadata(bridge);
    }

    if (normalizedCommitmentMatch !== undefined) {
        payload.commitmentMatch = normalizedCommitmentMatch;
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
        fields.bridge = toBridgeMetadata(payload.bridge);
    }

    fields.commitmentMatch = toCommitmentMatchMetadata(
        payload.commitmentMatch,
    );

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
        const localFields = swapMetadataToLocalFields(
            await decryptSwapMetadata(mnemonic, swap.metadata),
        );

        return {
            ...swap,
            ...localFields,
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
