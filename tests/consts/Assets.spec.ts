import type * as ConfigModule from "../../src/config";
import type * as MainnetConfigModule from "../../src/configs/mainnet";
import {
    BTC,
    LBTC,
    LN,
    RBTC,
    USDT0,
    getAssetDisplaySymbol,
    getBridgeVariants,
    getCanonicalAsset,
    isBridgeAsset,
    isBridgeCanonicalAsset,
    isBridgeVariant,
    isStablecoinAsset,
} from "../../src/consts/Assets";

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");
    const mainnet = await vi.importActual<typeof MainnetConfigModule>(
        "../../src/configs/mainnet",
    );

    return {
        ...actual,
        config: mainnet.config,
    };
});

describe("Assets", () => {
    describe("getCanonicalAsset", () => {
        test.each`
            input           | expected
            ${BTC}          | ${BTC}
            ${LBTC}         | ${LBTC}
            ${LN}           | ${LN}
            ${RBTC}         | ${RBTC}
            ${USDT0}        | ${USDT0}
            ${"USDT0-ETH"}  | ${USDT0}
            ${"USDT0-POL"}  | ${USDT0}
            ${"USDT0-BERA"} | ${USDT0}
        `("$input -> $expected", ({ input, expected }) => {
            expect(getCanonicalAsset(input)).toBe(expected);
        });
    });

    describe("getAssetDisplaySymbol", () => {
        test.each`
            input           | expected
            ${BTC}          | ${"BTC"}
            ${LBTC}         | ${"LBTC"}
            ${LN}           | ${"LN"}
            ${RBTC}         | ${"RBTC"}
            ${USDT0}        | ${"USDT"}
            ${"USDT0-ETH"}  | ${"USDT"}
            ${"USDT0-POL"}  | ${"USDT"}
            ${"USDT0-BERA"} | ${"USDT"}
        `("$input -> $expected", ({ input, expected }) => {
            expect(getAssetDisplaySymbol(input)).toBe(expected);
        });
    });

    describe("isBridgeAsset", () => {
        test.each`
            input          | expected
            ${BTC}         | ${false}
            ${RBTC}        | ${false}
            ${USDT0}       | ${true}
            ${"USDT0-ETH"} | ${true}
            ${"USDT0-POL"} | ${true}
            ${"not-a-key"} | ${false}
        `("$input -> $expected", ({ input, expected }) => {
            expect(isBridgeAsset(input)).toBe(expected);
        });
    });

    describe("isBridgeCanonicalAsset", () => {
        test.each`
            input          | expected
            ${BTC}         | ${false}
            ${USDT0}       | ${true}
            ${"USDT0-ETH"} | ${false}
            ${"USDT0-POL"} | ${false}
        `("$input -> $expected", ({ input, expected }) => {
            expect(isBridgeCanonicalAsset(input)).toBe(expected);
        });
    });

    describe("isBridgeVariant", () => {
        test.each`
            input          | expected
            ${BTC}         | ${false}
            ${USDT0}       | ${false}
            ${"USDT0-ETH"} | ${true}
            ${"USDT0-POL"} | ${true}
        `("$input -> $expected", ({ input, expected }) => {
            expect(isBridgeVariant(input)).toBe(expected);
        });
    });

    describe("getBridgeVariants", () => {
        test("returns every chain variant of USDT0 but not USDT0 itself", () => {
            const variants = getBridgeVariants(USDT0);
            expect(variants).not.toContain(USDT0);
            expect(variants).toContain("USDT0-ETH");
            expect(variants).toContain("USDT0-POL");
            expect(variants.every((v) => v.startsWith("USDT0-"))).toBe(true);
        });

        test("returns empty list for an asset with no variants", () => {
            expect(getBridgeVariants(BTC)).toEqual([]);
            expect(getBridgeVariants(RBTC)).toEqual([]);
        });
    });

    describe("isStablecoinAsset", () => {
        test.each`
            input          | expected
            ${BTC}         | ${false}
            ${RBTC}        | ${false}
            ${USDT0}       | ${true}
            ${"USDT0-ETH"} | ${true}
            ${"USDT0-POL"} | ${true}
        `("$input -> $expected", ({ input, expected }) => {
            expect(isStablecoinAsset(input)).toBe(expected);
        });
    });
});
