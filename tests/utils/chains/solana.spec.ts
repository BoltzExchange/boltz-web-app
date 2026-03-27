// @vitest-environment node
import { afterAll, beforeAll, expect, test } from "vitest";

import { config as runtimeConfig } from "../../../src/config";
import { config as mainnetConfig } from "../../../src/configs/mainnet";
import {
    decodeSolanaAddress,
    isValidSolanaAddress,
    shouldCreateSolanaTokenAccount,
} from "../../../src/utils/chains/solana";

const originalAssets = structuredClone(runtimeConfig.assets ?? {});
const originalNetwork = runtimeConfig.network;
const knownRecipientWithUsdtAta =
    "6bGbFocpK9tzyDsZEWrQkixm6WCGsnqvYPcXpAR7Pc9t";
const knownRecipientWithoutUsdtAta =
    "6TEStwWeG24Yxhh7rx4pwpC7TVwJXNGDM5FqeiiKtZGX";

beforeAll(() => {
    runtimeConfig.assets = structuredClone(mainnetConfig.assets);
    runtimeConfig.network = mainnetConfig.network;
});

afterAll(() => {
    runtimeConfig.assets = originalAssets;
    runtimeConfig.network = originalNetwork;
});

test("should validate Solana base58 recipients", () => {
    const recipient = "11111111111111111111111111111111";
    const invalidRecipients = [
        "",
        "1111111111111111111111111111111",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "O0Il1111111111111111111111111111",
    ];

    expect(isValidSolanaAddress(recipient)).toBe(true);
    expect(decodeSolanaAddress(recipient)).toHaveLength(32);

    invalidRecipients.forEach((invalidRecipient) => {
        expect(isValidSolanaAddress(invalidRecipient)).toBe(false);
        expect(() => decodeSolanaAddress(invalidRecipient)).toThrow();
    });
});

test("should detect live Solana USDT ATA creation requirements on mainnet", async () => {
    expect(
        await shouldCreateSolanaTokenAccount(
            "USDT0-SOL",
            knownRecipientWithUsdtAta,
        ),
    ).toBe(false);

    expect(
        await shouldCreateSolanaTokenAccount(
            "USDT0-SOL",
            knownRecipientWithoutUsdtAta,
        ),
    ).toBe(true);
}, 60_000);
