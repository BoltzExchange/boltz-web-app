// @vitest-environment node
import { expect, test } from "vitest";

import { JsonRpcProvider } from "../../node_modules/ethers/lib.commonjs/providers/provider-jsonrpc.js";
import { config } from "../../src/configs/mainnet";

const usdt0VariantRpcEndpoints = Object.entries(config.assets).flatMap(
    ([asset, assetConfig]) => {
        const network = assetConfig.network;

        if (!asset.startsWith("USDT0-") || network === undefined) {
            return [];
        }

        return network.rpcUrls.map((rpcUrl) => ({
            asset,
            chainId: network.chainId,
            chainName: network.chainName,
            rpcUrl,
        }));
    },
);

test("USDT0 mainnet RPC endpoints should respond with the configured chain id", async () => {
    const failures: string[] = [];

    for (const endpoint of usdt0VariantRpcEndpoints) {
        const provider = new JsonRpcProvider(endpoint.rpcUrl);

        try {
            const [network, blockNumber] = await Promise.all([
                provider.getNetwork(),
                provider.getBlockNumber(),
            ]);

            if (Number(network.chainId) !== endpoint.chainId) {
                failures.push(
                    `${endpoint.asset} (${endpoint.chainName}) at ${endpoint.rpcUrl} reported chain id ${network.chainId.toString()} instead of ${endpoint.chainId}`,
                );
            }

            if (blockNumber < 0) {
                failures.push(
                    `${endpoint.asset} (${endpoint.chainName}) at ${endpoint.rpcUrl} returned an invalid block number ${blockNumber}`,
                );
            }
        } catch (error) {
            failures.push(
                `${endpoint.asset} (${endpoint.chainName}) at ${endpoint.rpcUrl} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            provider.destroy();
        }
    }

    expect(failures).toEqual([]);
}, 120_000);
