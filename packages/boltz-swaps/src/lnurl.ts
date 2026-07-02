import { bech32, utf8 } from "@scure/base";

import { LnurlAmountError, LnurlAmountErrorKind } from "./errors.ts";
import { fetchExternalJson } from "./http/external.ts";
import { getLogger } from "./logger.ts";
import type { FetchOptions } from "./types.ts";
import { defaultFetchTimeoutMs, timeoutSignal } from "./util/abort.ts";

const lightningPrefix = "lightning:";

type LnurlResponse = {
    minSendable: number;
    maxSendable: number;
    callback: string;
};

type LnurlCallbackResponse = {
    pr: string;
};

const emailRegex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const stripLightningPrefix = (data: string): string =>
    data.toLowerCase().startsWith(lightningPrefix)
        ? data.slice(lightningPrefix.length)
        : data;

export const isValidBech32 = (data: string): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    try {
        bech32.decodeToBytes(data);
        return true;
    } catch {
        return false;
    }
};

export const isLnurl = (data: string | null | undefined): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    const normalized = stripLightningPrefix(data).toLowerCase();
    return (
        (normalized.includes("@") && emailRegex.test(normalized)) ||
        (normalized.startsWith("lnurl") && isValidBech32(normalized))
    );
};

const checkLnurlResponse = (amountMsat: bigint, data: LnurlResponse): void => {
    getLogger().debug(
        "lnurl amount check: (x, min, max)",
        amountMsat.toString(),
        data.minSendable,
        data.maxSendable,
    );

    if (amountMsat < BigInt(Math.ceil(data.minSendable))) {
        throw new LnurlAmountError(LnurlAmountErrorKind.Min, data.minSendable);
    }
    if (amountMsat > BigInt(Math.floor(data.maxSendable))) {
        throw new LnurlAmountError(LnurlAmountErrorKind.Max, data.maxSendable);
    }
};

export const fetchLnurlInvoice = async (
    amountMsat: bigint,
    data: LnurlResponse,
    opts?: FetchOptions,
): Promise<string> => {
    const url = new URL(data.callback);
    url.searchParams.set("amount", amountMsat.toString());
    getLogger().debug("fetching invoice", url.toString());
    const res = await fetchExternalJson<LnurlCallbackResponse>(
        url.toString(),
        opts?.timeoutMs,
        { signal: opts?.signal },
    );
    getLogger().debug("fetched invoice", res);
    return res.pr;
};

export const fetchLnurl = async (
    lnurl: string,
    amountSat: number,
    opts?: FetchOptions,
): Promise<string> => {
    const normalized = stripLightningPrefix(lnurl);
    let url: string;
    if (normalized.includes("@")) {
        const [user, domain] = normalized.split("@");
        url = `https://${domain}/.well-known/lnurlp/${user}`;
    } else {
        const { bytes } = bech32.decodeToBytes(normalized.toLowerCase());
        url = utf8.encode(bytes);
    }

    const timeoutMs = opts?.timeoutMs ?? defaultFetchTimeoutMs;
    const signal = timeoutSignal({ signal: opts?.signal, timeoutMs });

    const amountMsat = BigInt(Math.round(amountSat * 1_000));
    getLogger().debug("Fetching LNURL:", url);

    const res = await fetchExternalJson<LnurlResponse>(url, timeoutMs, {
        signal,
    });
    checkLnurlResponse(amountMsat, res);
    return await fetchLnurlInvoice(amountMsat, res, { signal, timeoutMs });
};
