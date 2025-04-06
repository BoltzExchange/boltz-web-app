import type { WASMProofBuilder } from "./dnssec_prover_wasm.js";
import init from "./dnssec_prover_wasm.js";
import * as wasm from "./dnssec_prover_wasm.js";

/*
 * Based on: https://github.com/TheBlueMatt/satsto.me/blob/6fe1d5c027db0cbf928e961277b19addfa955577/static/doh_lookup.js
 * Copyright: Matt Corallo 2024
 */

type DnsType = "txt" | "tsla" | "a" | "aaaa";

type RRS = {
    type: DnsType;
    name: string;
    contents: string;
};

type LookupResult = {
    expires: number;
    valid_from: number;
    max_cache_ttl: number;
    verified_rrs: RRS[];
};

const sendQuery = async (
    builder: WASMProofBuilder,
    domain: string,
    dohEndpoint: string,
): Promise<LookupResult> => {
    const query = wasm.get_next_query(builder);
    if (query === null || query === undefined) {
        const proof = wasm.get_unverified_proof(builder);
        if (proof === null) {
            throw "failed to build proof";
        }

        return JSON.parse(
            wasm.verify_byte_stream(proof, domain),
        ) as LookupResult;
    }

    const b64url = btoa(String.fromCodePoint(...query))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

    const resp = await fetch(dohEndpoint + "?dns=" + b64url, {
        headers: { accept: "application/dns-message" },
    });
    if (!resp.ok) {
        throw "DoH query failed";
    }

    const buf = new Uint8Array(await resp.arrayBuffer());
    wasm.process_query_response(builder, buf);

    return await sendQuery(builder, domain, dohEndpoint);
};

export const lookup = async (
    domain: string,
    dnsType: DnsType,
    dohEndpoint: string,
): Promise<LookupResult> => {
    await init();

    if (!domain.endsWith(".")) domain += ".";

    let ty: number;
    switch (dnsType) {
        case "txt":
            ty = 16;
            break;

        case "tsla":
            ty = 52;
            break;

        case "a":
            ty = 1;
            break;

        case "aaaa":
            ty = 28;
            break;

        default:
            throw "invalid DNS lookup type";
    }

    const builder = wasm.init_proof_builder(domain, ty);
    if (builder == null) {
        throw "bad domain";
    }

    return await sendQuery(builder, domain, dohEndpoint);
};
