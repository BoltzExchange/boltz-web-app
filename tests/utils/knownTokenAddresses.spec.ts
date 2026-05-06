import { config as runtimeConfig } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { BTC, RBTC, TBTC, USDC, USDT0 } from "../../src/consts/Assets";
import { isKnownTokenAddress } from "../../src/utils/knownTokenAddresses";

const originalAssets = structuredClone(runtimeConfig.assets ?? {});

beforeAll(() => {
    runtimeConfig.assets = {
        ...runtimeConfig.assets,
        "USDC-SOL": structuredClone(mainnetConfig.assets!["USDC-SOL"]),
        "USDT0-SOL": structuredClone(mainnetConfig.assets!["USDT0-SOL"]),
        "USDT0-TRON": structuredClone(mainnetConfig.assets!["USDT0-TRON"]),
    };
});

afterAll(() => {
    runtimeConfig.assets = originalAssets;
});

describe("known token addresses", () => {
    test.each`
        asset           | tokenAddress
        ${TBTC}         | ${"0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40"}
        ${USDC}         | ${"0xAF88D065E77C8CC2239327C5EDB3A432268E5831"}
        ${USDT0}        | ${"0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9"}
        ${"USDC-SOL"}   | ${"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
        ${"USDT0-SOL"}  | ${"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"}
        ${"USDT0-TRON"} | ${"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"}
    `(
        "matches $asset token address $tokenAddress",
        ({ asset, tokenAddress }) => {
            expect(isKnownTokenAddress(asset, tokenAddress)).toBe(true);
        },
    );

    test("matches a different token address", () => {
        expect(
            isKnownTokenAddress(
                "USDT0-SOL",
                runtimeConfig.assets!["USDC-SOL"].token!.address,
            ),
        ).toBe(true);
    });

    test("matches another configured token address for the same asset", () => {
        expect(
            isKnownTokenAddress(
                "USDC-SOL",
                runtimeConfig.assets!.USDC.token!.address,
            ),
        ).toBe(true);
    });

    test("does not lowercase case-sensitive token addresses", () => {
        expect(
            isKnownTokenAddress(
                "USDT0-TRON",
                runtimeConfig.assets![
                    "USDT0-TRON"
                ].token!.address.toLowerCase(),
            ),
        ).toBe(false);
    });

    test("does not match regular addresses", () => {
        expect(
            isKnownTokenAddress(
                USDC,
                "0x1000000000000000000000000000000000000000",
            ),
        ).toBe(false);
    });

    test.each`
        asset
        ${BTC}
        ${RBTC}
    `("ignores non-ERC20 asset $asset", ({ asset }) => {
        expect(
            isKnownTokenAddress(
                asset,
                runtimeConfig.assets!.USDC.token!.address,
            ),
        ).toBe(false);
    });
});
