import {
    BTC,
    LBTC,
    LN,
    RBTC,
    USDT0,
    getAssetDisplaySymbol,
    getCanonicalAsset,
} from "../../src/consts/Assets";

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
});
