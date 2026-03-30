// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";

import { config as runtimeConfig } from "../../../src/config";
import { config as mainnetConfig } from "../../../src/configs/mainnet";
import lazySolana from "../../../src/lazy/solana";
import {
    clearSolanaTokenAccountCreationCache,
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
const mockAssociatedTokenAddress =
    "7MtyL1S2G9Tz2qtPCQEW4Gm2rjS2JdT1oP2E6dLkK8sQ";

beforeAll(() => {
    runtimeConfig.assets = structuredClone(mainnetConfig.assets);
    runtimeConfig.network = mainnetConfig.network;
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    clearSolanaTokenAccountCreationCache();
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

const stubSolanaAtaLookup = (
    accountInfoValue: Record<string, unknown> | null,
) => {
    vi.spyOn(lazySolana, "get").mockResolvedValue({
        PublicKey: class {
            constructor(private readonly value: string) {}

            toBase58 = () => this.value;
        },
        getAssociatedTokenAddressSync: () => ({
            toBase58: () => mockAssociatedTokenAddress,
        }),
    } as never);

    const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
            result: {
                value: accountInfoValue,
            },
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    return fetchSpy;
};

test("should cache false ATA creation results", async () => {
    clearSolanaTokenAccountCreationCache();
    const fetchSpy = stubSolanaAtaLookup({
        data: ["", "base64"],
    });

    await expect(
        shouldCreateSolanaTokenAccount("USDT0-SOL", knownRecipientWithUsdtAta),
    ).resolves.toBe(false);
    await expect(
        shouldCreateSolanaTokenAccount("USDT0-SOL", knownRecipientWithUsdtAta),
    ).resolves.toBe(false);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("should not cache true ATA creation results", async () => {
    clearSolanaTokenAccountCreationCache();
    const fetchSpy = stubSolanaAtaLookup(null);

    await expect(
        shouldCreateSolanaTokenAccount(
            "USDT0-SOL",
            knownRecipientWithoutUsdtAta,
        ),
    ).resolves.toBe(true);
    await expect(
        shouldCreateSolanaTokenAccount(
            "USDT0-SOL",
            knownRecipientWithoutUsdtAta,
        ),
    ).resolves.toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
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
