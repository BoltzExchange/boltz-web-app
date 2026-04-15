import { afterEach, describe, expect, test, vi } from "vitest";

import type * as ConfigModule from "../../src/config";
import { NetworkTransport, Usdt0Kind } from "../../src/configs/base";
import {
    gasTopUpSupported,
    getGasTopUpNativeAmount,
    getGasTopUpToken,
} from "../../src/utils/quoter";

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: {
            ...actual.config,
            assets: {
                ...actual.config.assets,
                "USDT0-POL": {
                    ...actual.config.assets.USDT0,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Polygon PoS",
                        symbol: "POL",
                        gasToken: "POL",
                        chainId: 137,
                        nativeCurrency: {
                            name: "POL",
                            symbol: "POL",
                            decimals: 18,
                        },
                    },
                },
                "USDT0-CORN": {
                    ...actual.config.assets.USDT0,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Corn",
                        symbol: "CORN",
                        gasToken: "BTCN",
                        chainId: 21000000,
                        nativeCurrency: {
                            name: "BTCN",
                            symbol: "BTCN",
                            decimals: 18,
                        },
                    },
                },
                "USDT0-STABLE": {
                    ...actual.config.assets.USDT0,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Stable",
                        symbol: "STABLE",
                        gasToken: "USDT0",
                        chainId: 988,
                        nativeCurrency: {
                            name: "USDT0",
                            symbol: "USDT0",
                            decimals: 18,
                        },
                    },
                },
                "USDT0-SOL": {
                    ...actual.config.assets.USDT0,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Solana",
                        symbol: "SOL",
                        gasToken: "SOL",
                        transport: NetworkTransport.Solana,
                        mesh: Usdt0Kind.Legacy,
                        rpcUrls: ["https://api.mainnet.solana.com"],
                        nativeCurrency: {
                            name: "SOL",
                            symbol: "SOL",
                            decimals: 9,
                            minGas: 1_500_000n,
                        },
                    },
                },
            },
        },
    };
});

describe("quoter gas top-up", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should disable gas top-up for USDT0 destinations without price support", () => {
        expect(getGasTopUpToken("USDT0-POL")).toBe("POL");
        expect(gasTopUpSupported("USDT0-POL")).toBe(true);

        expect(getGasTopUpToken("USDT0-SOL")).toBe("SOL");
        expect(gasTopUpSupported("USDT0-SOL")).toBe(true);

        expect(getGasTopUpToken("USDT0-CORN")).toBe("BTCN");
        expect(gasTopUpSupported("USDT0-CORN")).toBe(false);

        expect(getGasTopUpToken("USDT0-STABLE")).toBe("USDT0");
        expect(gasTopUpSupported("USDT0-STABLE")).toBe(false);
    });

    test("should size top-up amounts using the destination gas token price", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                "polygon-ecosystem-token": { usd: 0.5 },
            }),
        } as unknown as Response);

        await expect(getGasTopUpNativeAmount("USDT0-POL")).resolves.toBe(
            200_000_000_000_000_000n,
        );
    });

    test("should apply the configured minGas floor for Solana top-ups", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                solana: { usd: 100 },
            }),
        } as unknown as Response);

        await expect(getGasTopUpNativeAmount("USDT0-SOL")).resolves.toBe(
            1_500_000n,
        );
    });

    test("should reject gas-drop amounts for USDT0 gas token destinations", async () => {
        await expect(getGasTopUpNativeAmount("USDT0-STABLE")).rejects.toThrow(
            "gas drops are disabled for gas token USDT0",
        );
    });
});
