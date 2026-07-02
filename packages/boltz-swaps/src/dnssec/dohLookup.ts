import init, {
    type WASMProofBuilder,
    get_next_query,
    get_unverified_proof,
    init_proof_builder,
    process_query_response,
    verify_byte_stream,
} from "../generated/dnssec/dnssec_prover_wasm.ts";
import { getDnssecWasmBytes } from "../generated/dnssec/wasmBytes.ts";

/*
 * Based on: https://github.com/TheBlueMatt/satsto.me/blob/6fe1d5c027db0cbf928e961277b19addfa955577/static/doh_lookup.js
 * Copyright: Matt Corallo 2024
 */

type DnsType = "txt" | "tlsa" | "a" | "aaaa";

type RRS = {
    type: DnsType;
    name: string;
    contents: string;
};

export type LookupResult = {
    expires: number;
    valid_from: number;
    max_cache_ttl: number;
    verified_rrs: RRS[];
};

const dnsTypeCodes: Record<DnsType, number> = {
    txt: 16,
    tlsa: 52,
    a: 1,
    aaaa: 28,
};

const sendQuery = async (
    builder: WASMProofBuilder,
    domain: string,
    dohEndpoint: string,
    signal?: AbortSignal,
): Promise<LookupResult> => {
    const query = get_next_query(builder);
    if (query === null || query === undefined) {
        const proof = get_unverified_proof(builder);
        if (proof === null) {
            throw new Error("failed to build proof");
        }

        return JSON.parse(verify_byte_stream(proof, domain)) as LookupResult;
    }

    const b64url = btoa(String.fromCodePoint(...query))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

    const resp = await fetch(dohEndpoint + "?dns=" + b64url, {
        headers: { accept: "application/dns-message" },
        signal,
    });
    if (!resp.ok) {
        throw new Error("DoH query failed");
    }

    const buf = new Uint8Array(await resp.arrayBuffer());
    process_query_response(builder, buf);

    return await sendQuery(builder, domain, dohEndpoint, signal);
};

export const lookup = async (
    domain: string,
    dnsType: DnsType,
    dohEndpoint: string,
    signal?: AbortSignal,
): Promise<LookupResult> => {
    await init({ module_or_path: getDnssecWasmBytes() });

    const fqdn = domain.endsWith(".") ? domain : domain + ".";

    const builder = init_proof_builder(fqdn, dnsTypeCodes[dnsType]);
    if (builder === null || builder === undefined) {
        throw new Error("bad domain");
    }

    return await sendQuery(builder, fqdn, dohEndpoint, signal);
};
