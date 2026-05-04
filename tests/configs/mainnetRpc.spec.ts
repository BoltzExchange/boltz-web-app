// @vitest-environment node
import { Connection } from "@solana/web3.js";
import { createPublicClient, http } from "viem";
import { expect, test } from "vitest";

import type { Asset } from "../../src/configs/base";
import { NetworkTransport } from "../../src/configs/base";
import { config } from "../../src/configs/mainnet";

const rpcRequestTimeout = 10_000;

const hasLocalhostHost = (rpcUrl: string): boolean => {
    return new URL(rpcUrl).hostname === "localhost";
};

const fetchWithTimeout = async (
    url: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
) => {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort("RPC request timed out"),
        rpcRequestTimeout,
    );

    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
};

const assertEvmEndpoint = async (rpcUrl: string, expectedChainId: number) => {
    const provider = createPublicClient({
        transport: http(rpcUrl, {
            retryCount: 0,
            timeout: rpcRequestTimeout,
        }),
    });
    const [chainId, blockNumber] = await Promise.all([
        provider.getChainId(),
        provider.getBlockNumber(),
    ]);

    if (chainId !== expectedChainId) {
        throw new Error(
            `reported chain id ${chainId.toString()} instead of ${expectedChainId}`,
        );
    }
    if (blockNumber < 0n) {
        throw new Error(`returned an invalid block number ${blockNumber}`);
    }
};

// Operates on the iterated mainnet config rather than the runtime (regtest)
// config that `consts/Assets::isBridgeVariant` reads from.
const isBridgeVariantInConfig = (
    asset: string,
    assetConfig: Asset,
): boolean => {
    const bridge = assetConfig.bridge;
    return bridge !== undefined && bridge.canonicalAsset !== asset;
};

const bridgeVariantRpcEndpoints = Object.entries(config.assets ?? {}).flatMap(
    ([asset, assetConfig]) => {
        const network = assetConfig.network;

        if (
            !isBridgeVariantInConfig(asset, assetConfig) ||
            network?.transport !== NetworkTransport.Evm ||
            network.chainId === undefined ||
            network.rpcUrls === undefined
        ) {
            return [];
        }

        if (network.chainId === undefined) {
            return [];
        }
        return network.rpcUrls
            .filter((rpcUrl) => !hasLocalhostHost(rpcUrl))
            .map((rpcUrl) => ({
                asset,
                chainId: network.chainId!,
                chainName: network.chainName,
                rpcUrl,
            }));
    },
);

type BridgeVariantRpcEndpoint = (typeof bridgeVariantRpcEndpoints)[number];

type BridgeVariantRpcTestCase = {
    asset: string;
    chainId: number;
    chainName: string;
    rpcUrls: string[];
};

const bridgeVariantRpcTestCases = Array.from(
    bridgeVariantRpcEndpoints
        .reduce((chains, endpoint) => {
            const key = `${endpoint.asset}:${endpoint.chainId}`;
            const chainEndpoints = chains.get(key) ?? [];
            chainEndpoints.push(endpoint);
            chains.set(key, chainEndpoints);

            return chains;
        }, new Map<string, BridgeVariantRpcEndpoint[]>())
        .values(),
    (endpoints): BridgeVariantRpcTestCase => {
        const [chain] = endpoints;

        return {
            asset: chain.asset,
            chainId: chain.chainId,
            chainName: chain.chainName,
            rpcUrls: endpoints.map((endpoint) => endpoint.rpcUrl),
        };
    },
);

test.each(bridgeVariantRpcTestCases)(
    "$asset ($chainName) should have at least one working mainnet RPC endpoint",
    async ({ asset, chainId, chainName, rpcUrls }) => {
        const providerFailures: string[] = [];
        let hasWorkingProvider = false;

        for (const rpcUrl of rpcUrls) {
            try {
                await assertEvmEndpoint(rpcUrl, chainId);
                hasWorkingProvider = true;
            } catch (error) {
                providerFailures.push(
                    `${rpcUrl} failed: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }

        if (providerFailures.length > 0) {
            console.warn(
                `${asset} (${chainName}) had RPC provider failures:\n- ${providerFailures.join("\n- ")}`,
            );
        }

        if (!hasWorkingProvider) {
            throw new Error(
                `${asset} (${chainName}) has no working RPC providers:\n- ${providerFailures.join("\n- ")}`,
            );
        }

        expect(hasWorkingProvider).toBe(true);
    },
    120_000,
);

type NonEvmRpcTestCase = {
    asset: string;
    chainName: string;
    transport: NetworkTransport.Solana | NetworkTransport.Tron;
    rpcUrls: string[];
};

const nonEvmRpcTestCases: NonEvmRpcTestCase[] = Object.entries(
    config.assets ?? {},
).flatMap(([asset, assetConfig]) => {
    const network = assetConfig.network;
    const transport = network?.transport;

    if (
        !isBridgeVariantInConfig(asset, assetConfig) ||
        network?.rpcUrls === undefined ||
        (transport !== NetworkTransport.Solana &&
            transport !== NetworkTransport.Tron)
    ) {
        return [];
    }

    return [
        {
            asset,
            chainName: network.chainName,
            transport,
            rpcUrls: network.rpcUrls.filter(
                (rpcUrl) => !hasLocalhostHost(rpcUrl),
            ),
        },
    ];
});

const assertSolanaEndpoint = async (rpcUrl: string) => {
    const connection = new Connection(rpcUrl, {
        commitment: "confirmed",
        disableRetryOnRateLimit: true,
        fetch: (input, init) => fetchWithTimeout(input, init),
    });
    const slot = await connection.getSlot();

    if (!Number.isInteger(slot) || slot < 0) {
        throw new Error(`invalid slot result: ${slot.toString()}`);
    }
};

const assertTronEndpoint = async (rpcUrl: string) => {
    const response = await fetchWithTimeout(
        `${rpcUrl.replace(/\/$/, "")}/wallet/getnowblock`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: "{}",
        },
    );
    const block = (await response.json()) as {
        blockID?: string;
        block_header?: {
            raw_data?: {
                number?: number;
            };
        };
        Error?: string;
    };
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    if (block.Error !== undefined) {
        throw new Error(block.Error);
    }

    if (
        typeof block.blockID !== "string" ||
        typeof block.block_header?.raw_data?.number !== "number"
    ) {
        throw new Error(`invalid Tron RPC response: ${JSON.stringify(block)}`);
    }
};

const assertNonEvmEndpoint = async (
    rpcUrl: string,
    transport: NetworkTransport.Solana | NetworkTransport.Tron,
) => {
    switch (transport) {
        case NetworkTransport.Solana:
            await assertSolanaEndpoint(rpcUrl);
            break;

        case NetworkTransport.Tron:
            await assertTronEndpoint(rpcUrl);
            break;
    }
};

test.each(nonEvmRpcTestCases)(
    "$asset ($chainName) should have at least one working non-EVM RPC endpoint",
    async ({ asset, chainName, transport, rpcUrls }) => {
        const failures: string[] = [];
        let hasWorkingProvider = false;

        for (const rpcUrl of rpcUrls) {
            try {
                await assertNonEvmEndpoint(rpcUrl, transport);
                hasWorkingProvider = true;
            } catch (error) {
                failures.push(
                    `${rpcUrl} failed: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }

        if (failures.length > 0) {
            console.warn(
                `${asset} (${chainName}) had non-EVM RPC provider failures:\n- ${failures.join("\n- ")}`,
            );
        }

        if (!hasWorkingProvider) {
            throw new Error(
                `${asset} (${chainName}) has no working non-EVM RPC providers:\n- ${failures.join("\n- ")}`,
            );
        }

        expect(hasWorkingProvider).toBe(true);
    },
    120_000,
);
