import type * as ConfigModule from "../../src/config";
import { Usdt0Kind } from "../../src/configs/base";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import {
    BTC,
    LBTC,
    LN,
    RBTC,
    TBTC,
    USDC,
    USDT0,
    getAssetDisplaySymbol,
    getBridgeMesh,
    getBridgeVariants,
    getCanonicalAsset,
    getRouteViaAsset,
    getRouterAddress,
    isBridgeAsset,
    isBridgeCanonicalAsset,
    isBridgeVariant,
    isStablecoinAsset,
    requireRouterAddress,
} from "../../src/consts/Assets";

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: mainnetConfig,
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
            ${USDC}         | ${USDC}
            ${"USDT0-ETH"}  | ${USDT0}
            ${"USDT0-POL"}  | ${USDT0}
            ${"USDT0-BERA"} | ${USDT0}
            ${"USDC-BASE"}  | ${USDC}
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
            ${USDC}         | ${"USDC"}
            ${"USDT0-ETH"}  | ${"USDT"}
            ${"USDT0-POL"}  | ${"USDT"}
            ${"USDT0-BERA"} | ${"USDT"}
            ${"USDC-BASE"}  | ${"USDC"}
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

    describe("getBridgeMesh", () => {
        test("returns legacy when either OFT asset is on the legacy mesh", () => {
            expect(getBridgeMesh("USDT0-ETH", "USDT0-SOL")).toBe(
                Usdt0Kind.Legacy,
            );
        });

        test("throws for non-OFT bridge assets", () => {
            expect(() => getBridgeMesh("USDC-ETH", "USDT0-SOL")).toThrow(
                /requires OFT bridge assets/,
            );
        });
    });

    describe("getRouteViaAsset", () => {
        test.each`
            input             | expected
            ${USDT0}          | ${"TBTC"}
            ${"USDT0-ETH"}    | ${"TBTC"}
            ${"USDT0-TRON"}   | ${"TBTC"}
            ${"USDT0-POL"}    | ${"TBTC"}
            ${BTC}            | ${undefined}
            ${TBTC}           | ${undefined}
            ${"not-an-asset"} | ${undefined}
        `("$input -> $expected", ({ input, expected }) => {
            expect(getRouteViaAsset(input)).toBe(expected);
        });
    });

    describe("getRouterAddress", () => {
        const tbtcRouter = mainnetConfig.assets.TBTC.contracts!.router;

        test("resolves the canonical asset's routeVia hop router", () => {
            expect(getRouterAddress(USDT0)).toBe(tbtcRouter);
        });

        test("inherits the canonical router path for bridge variants", () => {
            expect(getRouterAddress("USDT0-ETH")).toBe(tbtcRouter);
            expect(getRouterAddress("USDT0-TRON")).toBe(tbtcRouter);
            expect(getRouterAddress("USDT0-POL")).toBe(tbtcRouter);
        });

        test("returns the asset's own router when it has no routeVia", () => {
            expect(getRouterAddress(TBTC)).toBe(tbtcRouter);
        });

        test.each([BTC, RBTC, "not-an-asset"])(
            "returns undefined for %s",
            (asset) => {
                expect(getRouterAddress(asset)).toBeUndefined();
            },
        );
    });

    describe("requireRouterAddress", () => {
        test("returns the resolved router for bridge variants", () => {
            expect(requireRouterAddress("USDT0-ETH")).toBe(
                requireRouterAddress(USDT0),
            );
        });

        test("throws when no router is configured", () => {
            expect(() => requireRouterAddress(BTC)).toThrow(
                /no router configured/,
            );
            expect(() => requireRouterAddress("not-an-asset")).toThrow(
                /no router configured/,
            );
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
            ${USDC}        | ${true}
            ${"USDC-ETH"}  | ${true}
            ${"USDC-POL"}  | ${true}
        `("$input -> $expected", ({ input, expected }) => {
            expect(isStablecoinAsset(input)).toBe(expected);
        });
    });
});
