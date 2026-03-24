// @vitest-environment node
import { expect, test } from "vitest";

import { JsonRpcProvider } from "../../node_modules/ethers/lib.commonjs/providers/provider-jsonrpc.js";
import { NetworkTransport } from "../../src/configs/base";
import { config } from "../../src/configs/mainnet";

const hasLocalhostHost = (rpcUrl: string): boolean => {
    return new URL(rpcUrl).hostname === "localhost";
};

const getAssetTransport = (asset: string): NetworkTransport | undefined => {
    const network = config.assets[asset]?.network;
    if (network?.transport !== undefined) {
        return network.transport;
    }

    return network?.chainId !== undefined ? NetworkTransport.Evm : undefined;
};

const usdt0VariantRpcEndpoints = Object.entries(config.assets).flatMap(
    ([asset, assetConfig]) => {
        const network = assetConfig.network;

        if (
            !asset.startsWith("USDT0-") ||
            network === undefined ||
            getAssetTransport(asset) !== NetworkTransport.Evm ||
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
