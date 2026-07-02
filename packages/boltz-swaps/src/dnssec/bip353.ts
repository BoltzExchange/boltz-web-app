import { fetchBolt12Invoice } from "../client.ts";
import { getDnsOverHttps } from "../config.ts";
import { validateInvoiceForOffer } from "../invoice.ts";
import { getLogger } from "../logger.ts";
import { lookup } from "./dohLookup.ts";

const bip353Prefix = "₿";

export const resolveBip353 = async (
    bip353: string,
    dohEndpoint: string = getDnsOverHttps(),
    signal?: AbortSignal,
): Promise<string> => {
    const split = bip353.split("@");
    if (split.length !== 2) {
        throw new Error("invalid BIP-353");
    }

    const user = split[0].startsWith(bip353Prefix)
        ? split[0].substring(bip353Prefix.length)
        : split[0];

    getLogger().debug(`Fetching BIP-353: ${bip353}`);

    const res = await lookup(
        `${user}.user._bitcoin-payment.${split[1]}`,
        "txt",
        dohEndpoint,
        signal,
    );

    const nowUnix = Date.now() / 1_000;
    if (nowUnix < res.valid_from) {
        throw new Error("proof is not valid yet");
    }
    if (nowUnix > res.expires) {
        throw new Error("proof has expired");
    }

    // BIP-353: ignore TXT records not starting with "bitcoin:" (case-insensitive);
    // more than one matching record is invalid.
    const paymentRequests = (res.verified_rrs ?? []).filter(
        (rr) =>
            rr.type === "txt" &&
            typeof rr.contents === "string" &&
            rr.contents.toLowerCase().startsWith("bitcoin:"),
    );
    if (paymentRequests.length === 0) {
        throw new Error("no bitcoin: TXT record");
    }
    if (paymentRequests.length > 1) {
        throw new Error("multiple bitcoin: TXT records");
    }

    const paymentRequest = paymentRequests[0].contents;
    const offerParam = new URLSearchParams(paymentRequest.split("?")[1]).get(
        "lno",
    );
    if (offerParam === null) {
        throw new Error("missing lno parameter in bip353 payment request");
    }
    const offer = offerParam.replaceAll('"', "");

    getLogger().debug("Resolved offer for BIP-353:", offer);
    return offer;
};

export const fetchBip353 = async (
    bip353: string,
    amountSat: number,
    dohEndpoint: string = getDnsOverHttps(),
    signal?: AbortSignal,
): Promise<string> => {
    const offer = await resolveBip353(bip353, dohEndpoint, signal);
    const invoice = (await fetchBolt12Invoice(offer, amountSat, { signal }))
        .invoice;
    validateInvoiceForOffer(offer, invoice);
    getLogger().debug("Resolved invoice for offer:", invoice);

    return invoice;
};
