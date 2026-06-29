import {
    MAINNET_API_DEFAULTS,
    getBoltzSwapsConfig,
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
