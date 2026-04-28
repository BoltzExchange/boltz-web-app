// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";

import { config as runtimeConfig } from "../../../src/config";
import { config as mainnetConfig } from "../../../src/configs/mainnet";
import lazySolana from "../../../src/lazy/solana";
import { clearCache } from "../../../src/utils/cache";
import {
    decodeSolanaAddress,
    getSolanaAccountInfo,
    getSolanaRentExemptMinimumBalance,
    isValidSolanaAddress,
    shouldCreateSolanaTokenAccount,
} from "../../../src/utils/chains/solana";

const originalAssets = structuredClone(runtimeConfig.assets);
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
    clearCache();
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
    const mockGetAccountInfo = vi.fn().mockResolvedValue(accountInfoValue);
    const mockGetVersion = vi.fn().mockResolvedValue({
        "solana-core": "2.1.0",
    });

    vi.spyOn(lazySolana, "get").mockResolvedValue({
        web3: {
            Connection: class {
                getVersion = mockGetVersion;
                getAccountInfo = mockGetAccountInfo;
            },
            PublicKey: class {
                constructor(private readonly value: string) {}

                toBase58 = () => this.value;
            },
        },
        splToken: {
            getAssociatedTokenAddressSync: () => ({
                toBase58: () => mockAssociatedTokenAddress,
            }),
        },
    } as never);

    return {
        mockGetAccountInfo,
        mockGetVersion,
    };
};

test("should cache false ATA creation results", async () => {
    clearCache();
    const { mockGetAccountInfo } = stubSolanaAtaLookup({
        data: ["", "base64"],
    });

    await expect(
        shouldCreateSolanaTokenAccount("USDT0-SOL", knownRecipientWithUsdtAta),
    ).resolves.toBe(false);
    await expect(
        shouldCreateSolanaTokenAccount("USDT0-SOL", knownRecipientWithUsdtAta),
    ).resolves.toBe(false);

    expect(mockGetAccountInfo).toHaveBeenCalledTimes(1);
});

test("should not cache true ATA creation results", async () => {
    clearCache();
    const { mockGetAccountInfo } = stubSolanaAtaLookup(null);

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

    expect(mockGetAccountInfo).toHaveBeenCalledTimes(2);
});

test("should cache Solana account info for existing accounts", async () => {
    const { mockGetAccountInfo, mockGetVersion } = stubSolanaAtaLookup({
        data: ["", "base64"],
    });

    await expect(
        getSolanaAccountInfo("USDT0-SOL", mockAssociatedTokenAddress),
    ).resolves.toEqual({
        data: ["", "base64"],
    });
    await expect(
        getSolanaAccountInfo("USDT0-SOL", mockAssociatedTokenAddress),
    ).resolves.toEqual({
        data: ["", "base64"],
    });

    expect(mockGetVersion).toHaveBeenCalledTimes(1);
    expect(mockGetAccountInfo).toHaveBeenCalledTimes(1);
});

test("should query and cache Solana rent-exempt minimum balances", async () => {
    const mockGetMinimumBalanceForRentExemption = vi
        .fn()
        .mockResolvedValue(2_039_280);
    const mockGetVersion = vi
        .fn()
        .mockResolvedValue({ "solana-core": "2.1.0" });

    vi.spyOn(lazySolana, "get").mockResolvedValue({
        web3: {
            Connection: class {
                getVersion = mockGetVersion;
                getMinimumBalanceForRentExemption =
                    mockGetMinimumBalanceForRentExemption;
            },
        },
    } as never);

    await expect(
        getSolanaRentExemptMinimumBalance("USDT0-SOL", 165),
    ).resolves.toBe(2_039_280n);
    await expect(
        getSolanaRentExemptMinimumBalance("USDT0-SOL", 165),
    ).resolves.toBe(2_039_280n);

    expect(mockGetVersion).toHaveBeenCalledTimes(1);
    expect(mockGetMinimumBalanceForRentExemption).toHaveBeenCalledTimes(1);
    expect(mockGetMinimumBalanceForRentExemption).toHaveBeenCalledWith(
        165,
        "confirmed",
    );
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
