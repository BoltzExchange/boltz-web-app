import { fetchBolt12Invoice } from "./client.ts";
import { isLnurlAmountError } from "./errors.ts";
import {
    InvoiceType,
    decodeInvoice,
    isBolt12Offer,
    isInvoice,
    validateInvoiceForOffer,
} from "./invoice.ts";
import { fetchLnurl, isLnurl, stripLightningPrefix } from "./lnurl.ts";
import type { FetchOptions } from "./types.ts";
import { firstResolvedPreferring } from "./util/promise.ts";

export type ResolveInvoiceResult = { invoice: string; type: InvoiceType };

export type ResolveInvoiceOptions = FetchOptions & {
    dnsOverHttps?: string;
};

// Resolves any Lightning destination (BOLT12 offer, LNURL, Lightning address,
// BIP-353 name, or a plain BOLT11/BOLT12 invoice) into a payable invoice for
// the given amount.
export const resolveInvoice = async (
    param: string,
    amountSat: number,
    opts?: ResolveInvoiceOptions,
): Promise<ResolveInvoiceResult> => {
    const p = stripLightningPrefix(param.trim());

    if (isBolt12Offer(p)) {
        const { invoice } = await fetchBolt12Invoice(p, amountSat, {
            signal: opts?.signal,
            timeoutMs: opts?.timeoutMs,
        });
        validateInvoiceForOffer(p, invoice);
        return { invoice, type: InvoiceType.Bolt12 };
    }

    // A Lightning address may be either an LNURL-pay host or a BIP-353 name;
    // race both and take whichever resolves first.
    if (p.includes("@") && isLnurl(p)) {
        const raceController = new AbortController();
        const signal =
            opts?.signal != null
                ? AbortSignal.any([raceController.signal, opts.signal])
                : raceController.signal;
        try {
            const invoice = await firstResolvedPreferring(
                [
                    fetchLnurl(p, amountSat, {
                        signal,
                        timeoutMs: opts?.timeoutMs,
                    }),
                    import("./dnssec/bip353.ts").then((m) =>
                        m.fetchBip353(p, amountSat, {
                            dnsOverHttps: opts?.dnsOverHttps,
                            signal,
                            timeoutMs: opts?.timeoutMs,
                        }),
                    ),
                ],
                isLnurlAmountError,
            );
            return { invoice, type: decodeInvoice(invoice).type };
        } finally {
            raceController.abort(new Error("resolution race settled"));
        }
    }

    if (isLnurl(p)) {
        const invoice = await fetchLnurl(p, amountSat, {
            signal: opts?.signal,
            timeoutMs: opts?.timeoutMs,
        });
        return { invoice, type: decodeInvoice(invoice).type };
    }

    // Network-aware gate: rejects e.g. BOLT11 invoices for another network,
    // which decodeInvoice alone would accept.
    if (!isInvoice(p)) {
        throw new Error("invalid invoice");
    }

    const { type } = decodeInvoice(p);
    return { invoice: p, type };
};
