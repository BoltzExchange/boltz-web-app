// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";

import { config as runtimeConfig } from "../../../src/config";
import { config as mainnetConfig } from "../../../src/configs/mainnet";
import lazyTron from "../../../src/lazy/tron";
import { clearCache } from "../../../src/utils/cache";
import {
    type TronTransactionInfo,
    decodeTronBase58Address,
    getTronNativeBalance,
    getTronTransactionSender,
    isFailedTronTransaction,
    isValidTronAddress,
    tronBase58ToHexAddress,
    tronHexToBase58Address,
} from "../../../src/utils/chains/tron";

const originalAssets = structuredClone(runtimeConfig.assets ?? {});
const originalNetwork = runtimeConfig.network;
const knownTronAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const createReceipt = (result: string) =>
    ({ result }) as TronTransactionInfo["receipt"];

beforeAll(() => {
    runtimeConfig.assets = structuredClone(mainnetConfig.assets);
    runtimeConfig.network = mainnetConfig.network;
});

afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
});

afterAll(() => {
    runtimeConfig.assets = originalAssets;
    runtimeConfig.network = originalNetwork;
});

const stubLazyTron = ({
    balance = 0,
    transaction,
}: {
    balance?: number;
    transaction?: unknown;
} = {}) => {
    const mockGetCurrentBlock = vi.fn().mockResolvedValue({
        blockID: "0000000000000001",
    });
    const mockGetBalance = vi.fn().mockResolvedValue(balance);
    const mockGetTransaction = vi.fn().mockResolvedValue(transaction ?? {});

    vi.spyOn(lazyTron, "get").mockResolvedValue({
        TronWeb: class {
            trx = {
                getBalance: mockGetBalance,
                getCurrentBlock: mockGetCurrentBlock,
                getTransaction: mockGetTransaction,
                getTransactionInfo: vi.fn(),
            };
        },
    } as never);

    return {
        mockGetBalance,
        mockGetCurrentBlock,
        mockGetTransaction,
    };
};

test("should validate Tron base58 recipients", () => {
    const invalidRecipients = [
        "TInvalidAddress",
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u",
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6",
    ];

    expect(isValidTronAddress(knownTronAddress)).toBe(true);
    expect(decodeTronBase58Address(knownTronAddress)).toHaveLength(20);
    expect(
        tronHexToBase58Address(tronBase58ToHexAddress(knownTronAddress)),
    ).toBe(knownTronAddress);

    invalidRecipients.forEach((invalidRecipient) => {
        expect(isValidTronAddress(invalidRecipient)).toBe(false);
        expect(() => decodeTronBase58Address(invalidRecipient)).toThrow();
    });
});

test("should classify failed Tron transaction receipts", () => {
    expect(
        isFailedTronTransaction({
            receipt: createReceipt("SUCCESS"),
        }),
    ).toBe(false);
    expect(
        isFailedTronTransaction({
            result: "FAILED",
            receipt: createReceipt("SUCCESS"),
        }),
    ).toBe(true);
    expect(
        isFailedTronTransaction({
            receipt: createReceipt("REVERT"),
        }),
    ).toBe(true);
});

test("should create and cache Tron clients behind the lazy loader", async () => {
    const { mockGetBalance, mockGetCurrentBlock } = stubLazyTron({
        balance: 1234,
    });

    await expect(
        getTronNativeBalance("USDT0-TRON", knownTronAddress),
    ).resolves.toBe(1234n);
    await expect(
        getTronNativeBalance("USDT0-TRON", knownTronAddress),
    ).resolves.toBe(1234n);

    expect(mockGetCurrentBlock).toHaveBeenCalledTimes(1);
    expect(mockGetBalance).toHaveBeenCalledTimes(2);
});

test("should invalidate cached Tron clients when the global cache is cleared", async () => {
    const { mockGetCurrentBlock } = stubLazyTron({
        balance: 1234,
    });

    await expect(
        getTronNativeBalance("USDT0-TRON", knownTronAddress),
    ).resolves.toBe(1234n);
    await expect(
        getTronNativeBalance("USDT0-TRON", knownTronAddress),
    ).resolves.toBe(1234n);

    clearCache();

    await expect(
        getTronNativeBalance("USDT0-TRON", knownTronAddress),
    ).resolves.toBe(1234n);

    expect(mockGetCurrentBlock).toHaveBeenCalledTimes(2);
});

test("should resolve the Tron transaction sender from the raw transaction", async () => {
    const ownerHex = `41${tronBase58ToHexAddress(knownTronAddress).slice(2)}`;
    const { mockGetTransaction } = stubLazyTron({
        transaction: {
            raw_data: {
                contract: [
                    {
                        parameter: {
                            value: {
                                owner_address: ownerHex,
                            },
                        },
                    },
                ],
            },
        },
    });

    await expect(
        getTronTransactionSender("USDT0-TRON", "trx-hash"),
    ).resolves.toBe(knownTronAddress);

    expect(mockGetTransaction).toHaveBeenCalledWith("trx-hash");
});
