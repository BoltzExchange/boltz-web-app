import { config as runtimeConfig } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { BTC, USDC, USDT0 } from "../../src/consts/Assets";
import { isKnownStablecoinTokenAddress } from "../../src/utils/knownTokenAddresses";

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

describe("known stablecoin token addresses", () => {
    test.each`
        asset           | tokenAddress
        ${USDC}         | ${"0xAF88D065E77C8CC2239327C5EDB3A432268E5831"}
        ${USDT0}        | ${"0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9"}
        ${"USDC-SOL"}   | ${"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
        ${"USDT0-SOL"}  | ${"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"}
        ${"USDT0-TRON"} | ${"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"}
    `(
        "matches $asset token address $tokenAddress",
        ({ asset, tokenAddress }) => {
            expect(isKnownStablecoinTokenAddress(asset, tokenAddress)).toBe(
                true,
            );
        },
    );

    test("matches a different stablecoin's token address", () => {
        expect(
            isKnownStablecoinTokenAddress(
                "USDT0-SOL",
                runtimeConfig.assets!["USDC-SOL"].token!.address,
            ),
        ).toBe(true);
    });

    test("matches another configured token address for the same stablecoin", () => {
        expect(
            isKnownStablecoinTokenAddress(
                "USDC-SOL",
                runtimeConfig.assets!.USDC.token!.address,
            ),
        ).toBe(true);
    });

    test("does not match regular addresses", () => {
        expect(
            isKnownStablecoinTokenAddress(
                USDC,
                "0x1000000000000000000000000000000000000000",
            ),
        ).toBe(false);
    });

    test("ignores assets without token config", () => {
        expect(
            isKnownStablecoinTokenAddress(
                BTC,
                runtimeConfig.assets!.USDC.token!.address,
            ),
        ).toBe(false);
    });
});
