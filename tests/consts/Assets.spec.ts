import type * as ConfigModule from "../../src/config";
import {
    BTC,
    LBTC,
    LN,
    LUSDT,
    RBTC,
    USDT0,
    getAssetDisplaySymbol,
    getAssetNetwork,
    getCanonicalAsset,
    isLiquidAsset,
    isLiquidTokenAsset,
} from "../../src/consts/Assets";

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");
    return {
        ...actual,
        config: {
            ...actual.config,
            assets: {
                ...actual.config.assets,
                "L-USDt": {
                    type: "LIQUID_TOKEN" as const,
                    canSend: false,
                    liquidToken: {
                        assetId: "fake-lusdt-asset-id",
                        precision: 8,
                        routeVia: "L-BTC",
                    },
                },
            },
        },
    };
});

describe("Assets", () => {
    describe("getCanonicalAsset", () => {
        test.each`
            input           | expected
            ${BTC}          | ${BTC}
            ${LBTC}         | ${LBTC}
            ${LUSDT}        | ${LUSDT}
            ${LN}           | ${LN}
            ${RBTC}         | ${RBTC}
            ${USDT0}        | ${USDT0}
            ${"USDT0-ETH"}  | ${USDT0}
            ${"USDT0-ARB"}  | ${USDT0}
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
            ${LUSDT}        | ${"USDT"}
            ${LN}           | ${"LN"}
            ${RBTC}         | ${"RBTC"}
            ${USDT0}        | ${"USDT"}
            ${"USDT0-ETH"}  | ${"USDT"}
            ${"USDT0-ARB"}  | ${"USDT"}
            ${"USDT0-BERA"} | ${"USDT"}
        `("$input -> $expected", ({ input, expected }) => {
            expect(getAssetDisplaySymbol(input)).toBe(expected);
        });
    });

    describe("isLiquidAsset", () => {
        test.each`
            asset    | expected
            ${LBTC}  | ${true}
            ${LUSDT} | ${true}
            ${BTC}   | ${false}
            ${LN}    | ${false}
            ${RBTC}  | ${false}
            ${USDT0} | ${false}
        `("$asset -> $expected", ({ asset, expected }) => {
            expect(isLiquidAsset(asset)).toBe(expected);
        });
    });

    describe("isLiquidTokenAsset", () => {
        test.each`
            asset    | expected
            ${LUSDT} | ${true}
            ${LBTC}  | ${false}
            ${BTC}   | ${false}
            ${USDT0} | ${false}
        `("$asset -> $expected", ({ asset, expected }) => {
            expect(isLiquidTokenAsset(asset)).toBe(expected);
        });
    });

    describe("getAssetNetwork", () => {
        test.each`
            asset    | expected
            ${BTC}   | ${"Bitcoin"}
            ${LN}    | ${"Lightning"}
            ${LBTC}  | ${"Liquid"}
            ${LUSDT} | ${"Liquid"}
        `("$asset -> $expected", ({ asset, expected }) => {
            expect(getAssetNetwork(asset)).toBe(expected);
        });
    });
});
