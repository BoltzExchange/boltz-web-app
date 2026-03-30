// @vitest-environment node
import { expect, test } from "vitest";

import { JsonRpcProvider } from "../../node_modules/ethers/lib.commonjs/providers/provider-jsonrpc.js";
import { NetworkTransport } from "../../src/configs/base";
import { config } from "../../src/configs/mainnet";
import { isUsdt0Variant } from "../../src/consts/Assets";

const hasLocalhostHost = (rpcUrl: string): boolean => {
    return new URL(rpcUrl).hostname === "localhost";
};

const usdt0VariantRpcEndpoints = Object.entries(config.assets).flatMap(
    ([asset, assetConfig]) => {
        const network = assetConfig.network;

        if (
            !isUsdt0Variant(asset) ||
            network?.transport !== NetworkTransport.Evm ||
            network.chainId === undefined ||
            network.rpcUrls === undefined
        ) {
            return [];
        }

        return network.rpcUrls
            .filter((rpcUrl) => !hasLocalhostHost(rpcUrl))
            .map((rpcUrl) => ({
                asset,
                chainId: network.chainId,
                chainName: network.chainName,
                rpcUrl,
            }));
    },
);

type Usdt0VariantRpcEndpoint = (typeof usdt0VariantRpcEndpoints)[number];

type Usdt0VariantRpcTestCase = {
    asset: string;
    chainId: number;
    chainName: string;
    rpcUrls: string[];
};

const usdt0VariantRpcTestCases = Array.from(
    usdt0VariantRpcEndpoints
        .reduce((chains, endpoint) => {
            const key = `${endpoint.asset}:${endpoint.chainId}`;
            const chainEndpoints = chains.get(key) ?? [];
            chainEndpoints.push(endpoint);
            chains.set(key, chainEndpoints);

            return chains;
        }, new Map<string, Usdt0VariantRpcEndpoint[]>())
        .values(),
    (endpoints): Usdt0VariantRpcTestCase => {
        const [chain] = endpoints;

        return {
            asset: chain.asset,
            chainId: chain.chainId,
            chainName: chain.chainName,
            rpcUrls: endpoints.map((endpoint) => endpoint.rpcUrl),
        };
    },
);

test.each(usdt0VariantRpcTestCases)(
    "$asset ($chainName) should have at least one working mainnet RPC endpoint",
    async ({ asset, chainId, chainName, rpcUrls }) => {
        const providerFailures: string[] = [];
        let hasWorkingProvider = false;

        for (const rpcUrl of rpcUrls) {
            const provider = new JsonRpcProvider(rpcUrl);

            try {
                const [network, blockNumber] = await Promise.all([
                    provider.getNetwork(),
                    provider.getBlockNumber(),
                ]);

                if (Number(network.chainId) !== chainId) {
                    providerFailures.push(
                        `${rpcUrl} reported chain id ${network.chainId.toString()} instead of ${chainId}`,
                    );
                    continue;
                }

                if (blockNumber < 0) {
                    providerFailures.push(
                        `${rpcUrl} returned an invalid block number ${blockNumber}`,
                    );
                    continue;
                }

                hasWorkingProvider = true;
            } catch (error) {
                providerFailures.push(
                    `${rpcUrl} failed: ${error instanceof Error ? error.message : String(error)}`,
                );
            } finally {
                provider.destroy();
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
    config.assets,
).flatMap(([asset, assetConfig]) => {
    const network = assetConfig.network;
    const transport = network?.transport;

    if (
        !isUsdt0Variant(asset) ||
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
    const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getSlot",
        }),
    });
    const body = (await response.json()) as {
        error?: { message?: string };
        result?: number;
    };
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    if (body.error !== undefined) {
        throw new Error(body.error.message ?? "unknown Solana RPC error");
    }
    if (typeof body.result !== "number" || body.result < 0) {
        throw new Error(`invalid slot result: ${JSON.stringify(body)}`);
    }
};

const assertTronEndpoint = async (rpcUrl: string) => {
    const response = await fetch(
        `${rpcUrl.replace(/\/$/, "")}/wallet/getnowblock`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: "{}",
        },
    );
    const body = (await response.json()) as {
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
    if (body.Error !== undefined) {
        throw new Error(body.Error);
    }
    if (
        typeof body.blockID !== "string" ||
        typeof body.block_header?.raw_data?.number !== "number"
    ) {
        throw new Error(`invalid Tron RPC response: ${JSON.stringify(body)}`);
    }
};

test.each(nonEvmRpcTestCases)(
    "$asset ($chainName) should have at least one working non-EVM RPC endpoint",
    async ({ asset, chainName, transport, rpcUrls }) => {
        const failures: string[] = [];
        let hasWorkingProvider = false;

        for (const rpcUrl of rpcUrls) {
            try {
                switch (transport) {
                    case NetworkTransport.Solana:
                        await assertSolanaEndpoint(rpcUrl);
                        break;

                    case NetworkTransport.Tron:
                        await assertTronEndpoint(rpcUrl);
                        break;
                }

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
