import {
    type BoltzSwapsConfigInput,
    MAINNET_API_DEFAULTS,
    getBoltzSwapsConfig,
    getDnsOverHttps,
    setBoltzSwapsConfig,
} from "boltz-swaps/config";
import { afterEach, describe, expect, test } from "vitest";

describe("boltz-swaps config defaults", () => {
    afterEach(() => {
        setBoltzSwapsConfig({});
    });

    test("defaults solburnUrl from mainnet API defaults", () => {
        setBoltzSwapsConfig({});

        expect(getBoltzSwapsConfig().solburnUrl).toBe(
            MAINNET_API_DEFAULTS.solburnUrl,
        );
    });

    test("allows overriding solburnUrl", () => {
        setBoltzSwapsConfig({ solburnUrl: "https://solburn.example" });

        expect(getBoltzSwapsConfig().solburnUrl).toBe(
            "https://solburn.example",
        );
    });

    test("round-trips a configured statusSource", () => {
        const statusSource = { subscribe: () => () => {}, close: () => {} };
        setBoltzSwapsConfig({ statusSource });

        expect(getBoltzSwapsConfig().statusSource).toBe(statusSource);
    });

    test("exposes an undefined statusSource when unset", () => {
        setBoltzSwapsConfig({});

        expect(getBoltzSwapsConfig().statusSource).toBeUndefined();
    });
});

describe("getDnsOverHttps", () => {
    afterEach(() => {
        setBoltzSwapsConfig({});
    });

    test("defaults to the Cloudflare DNS-over-HTTPS resolver", () => {
        setBoltzSwapsConfig({});

        expect(getDnsOverHttps()).toBe("https://1.1.1.1/dns-query");
    });

    test("returns a configured override", () => {
        setBoltzSwapsConfig({
            dnsOverHttps: "https://doh.example/dns-query",
        });

        expect(getDnsOverHttps()).toBe("https://doh.example/dns-query");
    });

    test("keeps an empty-string override (nullish coalescing, not truthiness)", () => {
        setBoltzSwapsConfig({ dnsOverHttps: "" });

        expect(getDnsOverHttps()).toBe("");
    });

    test("re-reads a live getter on every call", () => {
        let current = "https://first.example/dns-query";
        const input: BoltzSwapsConfigInput = {
            get dnsOverHttps() {
                return current;
            },
        };
        setBoltzSwapsConfig(input);

        expect(getDnsOverHttps()).toBe("https://first.example/dns-query");

        current = "https://second.example/dns-query";

        expect(getDnsOverHttps()).toBe("https://second.example/dns-query");
    });
});
