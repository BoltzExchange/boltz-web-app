import { bech32, utf8 } from "@scure/base";
import { BigNumber } from "bignumber.js";
import bolt11 from "bolt11";
import { Invoice, Offer } from "boltz-bolt12";
import log from "loglevel";

import { config } from "../config";
import { fetchBolt12Invoice } from "./boltzClient";
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

export const getExpiryEtaHours = (invoice: string): number => {
    const decoded = decodeInvoice(invoice);
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

export const decodeInvoice = (
    invoice: string,
): { satoshis: number; preimageHash: string; expiry?: number } => {
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
    } catch (e) {
        try {
            const decoded = new Invoice(invoice);
            const res = {
                satoshis: Number(decoded.amount_msat / 1_000n),
                preimageHash: Buffer.from(decoded.payment_hash).toString("hex"),
            };

            decoded.free();
            return res;
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

export const fetchBip353 = async (
    bip353: string,
    amountSat: number,
): Promise<string> => {
    const split = bip353.split("@");
    if (split.length !== 2) {
        throw "invalid BIP-353";
    }

    if (split[0].startsWith(bip353Prefix)) {
        split[0] = split[0].substring(bip353Prefix.length);
    }

    log.debug(`Fetching BIP-353: ${bip353}`);

    const params = new URLSearchParams({
        type: "TXT",
        name: `${split[0]}.user._bitcoin-payment.${split[1]}`,
    });
    const res = await fetch(`${config.dnsOverHttps}?${params.toString()}`, {
        headers: {
            Accept: "application/dns-json",
        },
    });
    const resBody = await res.json();
    if (resBody.Answer === undefined || resBody.Answer.length === 0) {
        throw "no TXT record";
    }

    const paymentRequest = resBody.Answer[0].data;
    const offer = new URLSearchParams(paymentRequest.split("?")[1]).get("lno");
    const invoice = (
        await fetchBolt12Invoice(offer.replaceAll('"', ""), amountSat)
    ).invoice;
    log.debug(`Resolved invoice for BIP-353:`, invoice);
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
    } catch (e) {
        return false;
    }
};

const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const isLnurl = (data: string) => {
    data = data.toLowerCase().replace(invoicePrefix, "");
    return (
        (data.includes("@") && emailRegex.test(data)) ||
        (data.startsWith("lnurl") && isValidBech32(data))
    );
};

export const isBolt12Offer = (offer: string) => {
    try {
        new Offer(offer);
        return true;
    } catch (e) {
        return false;
    }
};
