import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bech32, hex, utf8 } from "@scure/base";
import { BigNumber } from "bignumber.js";
import bolt11 from "bolt11";
import * as Bolt12 from "bolt12-utils";
import log from "loglevel";

import { config } from "../config";
import { BTC, LBTC, LN } from "../consts/Assets";
import { InvoiceValidation } from "../consts/Enums";
import { fetchBolt12Invoice } from "./boltzClient";
import { satToMiliSat } from "./denomination";
import { lookup } from "./dnssec/dohLookup";
import { checkResponse } from "./http";

export const enum InvoiceType {
    Bolt11,
    Bolt12,
}

type LnurlResponse = {
    minSendable: number;
    maxSendable: number;
    callback: string;
};

type LnurlCallbackResponse = {
    pr: string;
};

export const invoicePrefix = "lightning:";
export const bitcoinPrefix = "bitcoin:";
export const liquidPrefix = "liquidnetwork:";
export const liquidTestnetPrefix = "liquidtestnet:";

export const maxExpiryHours = 24;

const bolt11Prefixes = {
    mainnet: "lnbc",
    testnet: "lntb",
    regtest: "lnbcrt",
};

const bip353Prefix = "₿";
const compressedPubkeyLength = 33;
const encodedPathLengthCandidates = [8, compressedPubkeyLength];

const equalBytes = (a: Uint8Array, b: Uint8Array) => {
    return a.length === b.length && a.every((byte, index) => byte === b[index]);
};

const compressedPubkeyToXOnly = (pubkey: Uint8Array) => {
    const point = schnorr.Point.fromBytes(pubkey);
    return hex.decode(point.x.toString(16).padStart(64, "0"));
};

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
        throw new Error("invalid_bolt12_invoice");
    }

    const records = Bolt12.parseTlvStream(data);
    const fields = Bolt12.extractInvoiceFields(records);

    return {
        fields,
        records,
    };
};

export const decodeInvoice = (
    invoice: string,
): { type: InvoiceType; satoshis: number; preimageHash: string } => {
    try {
        const decoded = bolt11.decode(invoice);
        const sats = BigNumber(decoded.millisatoshis || 0)
            .dividedBy(1000)
            .integerValue(BigNumber.ROUND_HALF_UP)
            .toNumber();
        return {
            satoshis: sats,
            type: InvoiceType.Bolt11,
            preimageHash: decoded.tags.find(
                (tag) => tag.tagName === "payment_hash",
            ).data as string,
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        try {
            const { fields } = decodeBolt12Invoice(invoice);
            if (fields.invoice_payment_hash === undefined) {
                throw new Error("missing bolt12 payment hash");
            }

            return {
                type: InvoiceType.Bolt12,
                satoshis: Number((fields.invoice_amount ?? 0n) / 1_000n),
                preimageHash: hex.encode(fields.invoice_payment_hash),
            };

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            throw new Error("invalid_invoice");
        }
    }
};

export const fetchLnurl = async (
    lnurl: string,
    amount_sat: number,
): Promise<string> => {
    let url: string;
    if (lnurl.includes("@")) {
        // Lightning address
        const urlsplit = lnurl.split("@");
        url = `https://${urlsplit[1]}/.well-known/lnurlp/${urlsplit[0]}`;
    } else {
        // LNURL
        const { bytes } = bech32.decodeToBytes(lnurl);
        url = utf8.encode(bytes);
    }

    const amount = satToMiliSat(BigNumber(amount_sat));

    log.debug("Fetching LNURL:", url);

    const res = await checkResponse<LnurlResponse>(await fetch(url));
    checkLnurlResponse(amount, res);

    return await fetchLnurlInvoice(amount, res);
};

export const resolveBip353 = async (bip353: string): Promise<string> => {
    const split = bip353.split("@");
    if (split.length !== 2) {
        throw "invalid BIP-353";
    }

    if (split[0].startsWith(bip353Prefix)) {
        split[0] = split[0].substring(bip353Prefix.length);
    }

    log.debug(`Fetching BIP-353: ${bip353}`);

    const res = await lookup(
        `${split[0]}.user._bitcoin-payment.${split[1]}`,
        "txt",
        config.dnsOverHttps,
    );

    const nowUnix = Date.now() / 1_000;
    if (nowUnix < res.valid_from) {
        throw "proof is not valid yet";
    }
    if (nowUnix > res.expires) {
        throw "proof has expired";
    }

    if (res.verified_rrs === undefined || res.verified_rrs.length === 0) {
        throw "no TXT record";
    }

    if (res.verified_rrs[0].type !== "txt") {
        throw "invalid proof";
    }

    const paymentRequest = res.verified_rrs[0].contents;
    const offer = new URLSearchParams(paymentRequest.split("?")[1])
        .get("lno")
        .replaceAll('"', "");

    log.debug("Resolved offer for BIP-353:", offer);
    return offer;
};

export const fetchBip353 = async (
    bip353: string,
    amountSat: number,
): Promise<string> => {
    const offer = await resolveBip353(bip353);
    const invoice = (await fetchBolt12Invoice(offer, amountSat)).invoice;
    log.debug(`Resolved invoice for offer:`, invoice);

    return invoice;
};

const checkLnurlResponse = (amount: BigNumber, data: LnurlResponse) => {
    log.debug(
        "lnurl amount check: (x, min, max)",
        amount.toString(),
        data.minSendable,
        data.maxSendable,
    );

    if (amount.isLessThan(BigNumber(data.minSendable))) {
        throw new Error(InvoiceValidation.MinAmount, {
            cause: data.minSendable,
        });
    }
    if (amount.isGreaterThan(BigNumber(data.maxSendable))) {
        throw new Error(InvoiceValidation.MaxAmount, {
            cause: data.maxSendable,
        });
    }
    return data;
};

export const fetchLnurlInvoice = async (
    amount: BigNumber,
    data: LnurlResponse,
) => {
    const url = new URL(data.callback);
    url.searchParams.set("amount", amount.toString());
    log.debug("fetching invoice", url.toString());
    const res = await fetch(url.toString()).then(
        checkResponse<LnurlCallbackResponse>,
    );
    log.debug("fetched invoice", res);
    return res.pr;
};

export const isBip21 = (data: string) => {
    if (typeof data !== "string") {
        return false;
    }

    data = data.toLowerCase();
    return (
        data.startsWith(bitcoinPrefix) ||
        data.startsWith(liquidPrefix) ||
        data.startsWith(liquidTestnetPrefix)
    );
};

export const extractInvoice = (data: string) => {
    if (typeof data !== "string") {
        return null;
    }

    data = data.toLowerCase();
    if (data.startsWith(invoicePrefix)) {
        const url = new URL(data);
        return url.pathname;
    }
    if (isBip21(data)) {
        const url = new URL(data);
        return (
            url.searchParams.get("lightning") ||
            url.searchParams.get("lno") ||
            null
        );
    }
    return data;
};

export const extractAddress = (data: string) => {
    if (isBip21(data)) {
        const url = new URL(data);
        return url.pathname;
    }
    return data;
};

export const extractBip21Amount = (data: string) => {
    if (isBip21(data)) {
        const url = new URL(data);
        return BigNumber(url.searchParams.get("amount") ?? 0);
    }
    return null;
};

export const getAssetByBip21Prefix = (prefix: string) => {
    switch (prefix) {
        case bitcoinPrefix:
            return BTC;
        case liquidPrefix:
        case liquidTestnetPrefix:
            return LBTC;
        case invoicePrefix:
            return LN;
        default:
            return "";
    }
};

export const isInvoice = (data: string) => {
    if (typeof data !== "string") {
        return false;
    }

    const prefix = bolt11Prefixes[config.network];
    const startsWithPrefix = data.toLowerCase().startsWith(prefix);
    if (prefix === bolt11Prefixes.mainnet && startsWithPrefix) {
        return !data.toLowerCase().startsWith(bolt11Prefixes.regtest);
    }
    return startsWithPrefix || data.toLowerCase().startsWith("lni");
};

const isValidBech32 = (data: string) => {
    if (typeof data !== "string") {
        return false;
    }

    try {
        bech32.decodeToBytes(data);
        return true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

const emailRegex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const isLnurl = (data: string | null | undefined) => {
    if (typeof data !== "string") {
        return false;
    }

    data = data.toLowerCase().replace(invoicePrefix, "");
    return (
        (data.includes("@") && emailRegex.test(data)) ||
        (data.startsWith("lnurl") && isValidBech32(data))
    );
};

export const isBolt12Offer = (offer: string): boolean => {
    try {
        Bolt12.decodeOffer(offer);
        return true;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

export const validateInvoiceForOffer = (
    offer: string,
    invoice: string,
): boolean => {
    const possibleSigners: Uint8Array[] = [];
    const decodedOffer = Bolt12.decodeOffer(offer);
    const { fields, records } = decodeBolt12Invoice(invoice);

    if (decodedOffer.issuer_id !== undefined) {
        possibleSigners.push(hex.decode(decodedOffer.issuer_id));
    }

    if (decodedOffer.paths !== undefined) {
        possibleSigners.push(
            ...extractFinalBlindedNodeIds(hex.decode(decodedOffer.paths)),
        );
    }

    if (
        fields.invoice_node_id === undefined ||
        fields.signature === undefined ||
        !Bolt12.verifySignature(
            "invoice",
            Bolt12.computeMerkleRoot(records),
            compressedPubkeyToXOnly(fields.invoice_node_id),
            fields.signature,
        )
    ) {
        throw "invalid invoice signature";
    }

    for (const signer of possibleSigners) {
        if (equalBytes(signer, fields.invoice_node_id)) {
            return true;
        }
    }

    throw "invoice does not belong to offer";
};

export const checkInvoicePreimage = (
    invoice: string,
    preimage: string,
): void => {
    const dec = decodeInvoice(invoice);
    const hash = hex.encode(sha256(hex.decode(preimage)));

    if (hash !== dec.preimageHash) {
        throw "invalid preimage";
    }
};
