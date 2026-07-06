import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import bolt11 from "bolt11";
import * as Bolt12 from "bolt12-utils";

import { getConfiguredNetwork } from "./config.ts";

export enum InvoiceType {
    Bolt11 = "bolt11",
    Bolt12 = "bolt12",
}

const bolt11Prefixes = {
    mainnet: "lnbc",
    testnet: "lntb",
    regtest: "lnbcrt",
};

export const isInvoice = (data: string): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    const value = data.toLowerCase();
    const prefix = bolt11Prefixes[getConfiguredNetwork()];
    if (
        prefix === bolt11Prefixes.mainnet &&
        value.startsWith(bolt11Prefixes.regtest)
    ) {
        return false;
    }
    // BOLT11 HRP: prefix, optional amount with multiplier, then the "1"
    // separator; prefix alone (e.g. a "lnbc@host" Lightning address) is not
    // an invoice.
    return (
        new RegExp(`^${prefix}(\\d+[munp]?)?1.`).test(value) ||
        /^lni1./.test(value)
    );
};

export type DecodedInvoice = {
    type: InvoiceType;
    satoshis: number;
    preimageHash: string;
};

const compressedPubkeyLength = 33;
const encodedPathLengthCandidates = [8, compressedPubkeyLength];

const equalBytes = (a: Uint8Array, b: Uint8Array) =>
    a.length === b.length && a.every((byte, index) => byte === b[index]);

const compressedPubkeyToXOnly = (pubkey: Uint8Array) => {
    const point = schnorr.Point.fromBytes(pubkey);
    return hex.decode(point.x.toString(16).padStart(64, "0"));
};

const normalizeBolt12NodeId = (pubkey: Uint8Array) =>
    pubkey.length === compressedPubkeyLength
        ? compressedPubkeyToXOnly(pubkey)
        : pubkey;

// `bolt12-utils` exposes blinded paths as raw bytes, so parse just enough to
// recover the final `blinded_node_id` values that can sign returned invoices.
const parseFinalBlindedNodeIdSets = (
    paths: Uint8Array,
    offset: number,
    memo: Map<number, Uint8Array[][] | null>,
): Uint8Array[][] | null => {
    const cached = memo.get(offset);
    if (cached !== undefined) {
        return cached;
    }

    if (offset === paths.length) {
        return [[]];
    }

    const matches: Uint8Array[][] = [];

    for (const firstNodeLength of encodedPathLengthCandidates) {
        let cursor = offset;
        if (
            cursor + firstNodeLength + compressedPubkeyLength + 1 >
            paths.length
        ) {
            continue;
        }

        cursor += firstNodeLength;
        cursor += compressedPubkeyLength;

        const numHops = paths[cursor];
        cursor += 1;
        if (numHops === 0) {
            continue;
        }

        let finalNodeId: Uint8Array | undefined;
        let valid = true;

        for (let hop = 0; hop < numHops; hop += 1) {
            if (cursor + compressedPubkeyLength + 2 > paths.length) {
                valid = false;
                break;
            }

            finalNodeId = paths.slice(cursor, cursor + compressedPubkeyLength);
            cursor += compressedPubkeyLength;

            const encryptedDataLength =
                (paths[cursor] << 8) | paths[cursor + 1];
            cursor += 2;
            if (cursor + encryptedDataLength > paths.length) {
                valid = false;
                break;
            }

            cursor += encryptedDataLength;
        }

        if (!valid || finalNodeId === undefined) {
            continue;
        }

        const remainder = parseFinalBlindedNodeIdSets(paths, cursor, memo);
        if (remainder === null) {
            continue;
        }

        for (const rest of remainder) {
            matches.push([finalNodeId, ...rest]);
        }
    }

    const result = matches.length > 0 ? matches : null;
    memo.set(offset, result);

    return result;
};

const extractFinalBlindedNodeIds = (paths: Uint8Array) => {
    const parsed = parseFinalBlindedNodeIdSets(paths, 0, new Map());
    if (parsed === null) {
        return [];
    }

    const uniqueNodeIds = new Map<string, Uint8Array>();
    for (const candidates of parsed) {
        for (const nodeId of candidates) {
            uniqueNodeIds.set(hex.encode(nodeId), nodeId);
        }
    }

    return [...uniqueNodeIds.values()];
};

const decodeBolt12Invoice = (invoice: string) => {
    const { hrp, data } = Bolt12.decodeBolt12(invoice);
    if (hrp !== "lni") {
        throw new Error("invalid bolt12 invoice");
    }

    const records = Bolt12.parseTlvStream(data);
    return { fields: Bolt12.extractInvoiceFields(records), records };
};

export const decodeInvoice = (invoice: string): DecodedInvoice => {
    try {
        const decoded = bolt11.decode(invoice);
        const preimageHash = decoded.tags.find(
            (tag) => tag.tagName === "payment_hash",
        )?.data as string | undefined;
        if (preimageHash === undefined) {
            throw new Error("missing bolt11 payment hash");
        }
        return {
            type: InvoiceType.Bolt11,
            satoshis:
                decoded.satoshis ??
                Math.round(Number(decoded.millisatoshis ?? 0) / 1_000),
            preimageHash,
        };
    } catch (bolt11Error) {
        try {
            const { fields } = decodeBolt12Invoice(invoice);
            if (fields.invoice_payment_hash === undefined) {
                throw new Error("missing bolt12 payment hash", {
                    cause: bolt11Error,
                });
            }
            return {
                type: InvoiceType.Bolt12,
                satoshis: Number(
                    ((fields.invoice_amount ?? 0n) + 500n) / 1_000n,
                ),
                preimageHash: hex.encode(fields.invoice_payment_hash),
            };
        } catch (bolt12Error) {
            throw new Error("invalid invoice", { cause: bolt12Error });
        }
    }
};

export const isBolt12Offer = (offer: string): boolean => {
    try {
        Bolt12.decodeOffer(offer);
        return true;
    } catch {
        return false;
    }
};

// Verifies a bolt12 invoice is signed by the offer it claims to settle.
export const validateInvoiceForOffer = (
    offer: string,
    invoice: string,
): void => {
    const possibleSigners: Uint8Array[] = [];
    const decodedOffer = Bolt12.decodeOffer(offer);
    const { fields, records } = decodeBolt12Invoice(invoice);

    if (decodedOffer.issuer_id !== undefined) {
        possibleSigners.push(
            normalizeBolt12NodeId(hex.decode(decodedOffer.issuer_id)),
        );
    }

    if (decodedOffer.paths !== undefined) {
        possibleSigners.push(
            ...extractFinalBlindedNodeIds(hex.decode(decodedOffer.paths)).map(
                normalizeBolt12NodeId,
            ),
        );
    }

    if (
        fields.invoice_node_id === undefined ||
        fields.signature === undefined
    ) {
        throw new Error("invalid invoice signature");
    }

    const normalizedInvoiceNodeId = normalizeBolt12NodeId(
        fields.invoice_node_id,
    );

    if (
        !Bolt12.verifySignature(
            "invoice",
            Bolt12.computeMerkleRoot(records),
            normalizedInvoiceNodeId,
            fields.signature,
        )
    ) {
        throw new Error("invalid invoice signature");
    }

    for (const signer of possibleSigners) {
        if (equalBytes(signer, normalizedInvoiceNodeId)) {
            return;
        }
    }

    throw new Error("invoice does not belong to offer");
};

export const assertPreimageHash = (
    expectedHash: string,
    preimage: Uint8Array,
): void => {
    if (hex.encode(sha256(preimage)) !== expectedHash) {
        throw new Error("invalid preimage");
    }
};
