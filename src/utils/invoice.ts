import { bech32, utf8 } from "@scure/base";
import { BigNumber } from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import bolt11 from "bolt11";
import log from "loglevel";

import { config } from "../config";
import Bolt12 from "../lazy/bolt12";
import { fetchBolt12Invoice } from "./boltzClient";
import { lookup } from "./dnssec/dohLookup";
import { checkResponse } from "./http";

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

export const getExpiryEtaHours = async (invoice: string): Promise<number> => {
    const decoded = await decodeInvoice(invoice);
    const now = Date.now() / 1000;
    const delta = (decoded.expiry || 0) - now;
    if (delta < 0) {
        return 0;
    }
    const eta = Math.round(delta / 60 / 60);
    if (eta > maxExpiryHours) {
        return maxExpiryHours;
    }
    return eta;
};

export const decodeInvoice = async (
    invoice: string,
): Promise<{ satoshis: number; preimageHash: string; expiry?: number }> => {
    try {
        const decoded = bolt11.decode(invoice);
        const sats = BigNumber(decoded.millisatoshis || 0)
            .dividedBy(1000)
            .integerValue(BigNumber.ROUND_CEIL)
            .toNumber();
        return {
            satoshis: sats,
            expiry: decoded.timeExpireDate,
            preimageHash: decoded.tags.find(
                (tag) => tag.tagName === "payment_hash",
            ).data as string,
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        try {
            const mod = await Bolt12.get();
            const decoded = new mod.Invoice(invoice);
            const res = {
                satoshis: Number(decoded.amount_msat / 1_000n),
                preimageHash: Buffer.from(decoded.payment_hash).toString("hex"),
            };

            decoded.free();
            return res;

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

    const amount = Math.round(amount_sat * 1000);

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

const checkLnurlResponse = (amount: number, data: LnurlResponse) => {
    log.debug(
        "amount check: (x, min, max)",
        amount,
        data.minSendable,
        data.maxSendable,
    );
    if (amount < data.minSendable || amount > data.maxSendable) {
        throw new Error("Amount not in LNURL range.");
    }
    return data;
};

const fetchLnurlInvoice = async (amount: number, data: LnurlResponse) => {
    log.debug("fetching invoice", `${data.callback}?amount=${amount}`);
    const res = await fetch(`${data.callback}?amount=${amount}`).then(
        checkResponse<LnurlCallbackResponse>,
    );
    log.debug("fetched invoice", res);
    return res.pr;
};

export const isBip21 = (data: string) => {
    data = data.toLowerCase();
    return (
        data.startsWith(bitcoinPrefix) ||
        data.startsWith(liquidPrefix) ||
        data.startsWith(liquidTestnetPrefix)
    );
};

export const extractInvoice = (data: string) => {
    data = data.toLowerCase();
    if (data.startsWith(invoicePrefix)) {
        const url = new URL(data);
        return url.pathname;
    }
    if (isBip21(data)) {
        const url = new URL(data);
        return url.searchParams.get("lightning") || "";
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

export const isInvoice = (data: string) => {
    const prefix = bolt11Prefixes[config.network];
    const startsWithPrefix = data.toLowerCase().startsWith(prefix);
    if (prefix === bolt11Prefixes.mainnet && startsWithPrefix) {
        return !data.toLowerCase().startsWith(bolt11Prefixes.regtest);
    }
    return startsWithPrefix || data.toLowerCase().startsWith("lni");
};

const isValidBech32 = (data: string) => {
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

export const isLnurl = (data: string) => {
    data = data.toLowerCase().replace(invoicePrefix, "");
    return (
        (data.includes("@") && emailRegex.test(data)) ||
        (data.startsWith("lnurl") && isValidBech32(data))
    );
};

export const isBolt12Offer = async (offer: string) => {
    try {
        const { Offer } = await Bolt12.get();
        new Offer(offer);
        return true;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

export const validateInvoiceForOffer = async (
    offer: string,
    invoice: string,
) => {
    const { Offer, Invoice } = await Bolt12.get();
    const of = new Offer(offer);
    const possibleSigners: Uint8Array[] = [];

    if (of.signing_pubkey !== undefined) {
        possibleSigners.push(of.signing_pubkey);
    }

    for (const path of of.paths) {
        const hops = path.hops;
        if (hops.length > 0) {
            possibleSigners.push(hops[hops.length - 1].pubkey);
        }

        hops.forEach((hop) => hop.free());
        path.free();
    }

    of.free();

    const inv = new Invoice(invoice);

    try {
        const invoiceSigner = inv.signing_pubkey;

        for (const signer of possibleSigners) {
            if (signer.length !== invoiceSigner.length) {
                continue;
            }

            if (signer.every((b, i) => b === invoiceSigner[i])) {
                return true;
            }
        }
    } finally {
        inv.free();
    }

    throw "invoice does not belong to offer";
};

export const checkInvoicePreimage = async (
    invoice: string,
    preimage: string,
) => {
    const dec = await decodeInvoice(invoice);
    const hash = crypto.sha256(Buffer.from(preimage, "hex")).toString("hex");

    if (hash !== dec.preimageHash) {
        throw "invalid preimage";
    }
};
