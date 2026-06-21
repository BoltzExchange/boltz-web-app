import {
    getBoltzSwapsConfig,
    getConfiguredDefaultSlippage,
    setBoltzSwapsConfig,
} from "boltz-swaps/config";
import { afterEach, describe, expect, test } from "vitest";

describe("getConfiguredDefaultSlippage", () => {
    afterEach(() => {
        setBoltzSwapsConfig({});
    });

    test("defaults to 0.01 when defaultSlippage is unset", () => {
        setBoltzSwapsConfig({});

        expect(getConfiguredDefaultSlippage()).toBe(0.01);
    });

    test("returns the configured defaultSlippage", () => {
        setBoltzSwapsConfig({ defaultSlippage: 0.05 });

        expect(getConfiguredDefaultSlippage()).toBe(0.05);
    });

    test("returns 0 for an intentional zero defaultSlippage (uses ?? not ||)", () => {
        setBoltzSwapsConfig({ defaultSlippage: 0 });

        expect(getConfiguredDefaultSlippage()).toBe(0);
    });
});

describe("defaultSlippage config proxy passthrough", () => {
    afterEach(() => {
        setBoltzSwapsConfig({});
    });

    test("round-trips a configured defaultSlippage through getBoltzSwapsConfig", () => {
        setBoltzSwapsConfig({ defaultSlippage: 0.03 });

        expect(getBoltzSwapsConfig().defaultSlippage).toBe(0.03);
    });

    test("exposes undefined defaultSlippage when unset", () => {
        setBoltzSwapsConfig({});

        expect(getBoltzSwapsConfig().defaultSlippage).toBeUndefined();
    });
});
