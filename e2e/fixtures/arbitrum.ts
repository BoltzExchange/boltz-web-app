import { test as base, expect } from "@playwright/test";
import type { Address, Chain, PublicClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
    ARBITRUM_RPC_URL,
    arbitrumChain,
    arbitrumPublicClient,
    ensureBackendTbtcLiquidity,
} from "../../packages/boltz-swaps/integration/arbitrum";

const rpcTimeout = 120_000;

type ArbitrumE2e = {
    chain: Chain;
    publicClient: PublicClient;
    rpcUrl: string;
};

type ArbitrumFixtures = {
    arbitrum: ArbitrumE2e;
    recipientAddress: Address;
};

type ArbitrumWorkerFixtures = {
    arbitrumWorker: ArbitrumE2e;
};

const envValue = (...names: string[]) =>
    names
        .map((name) => process.env[name])
        .find((value): value is string => value !== undefined && value !== "");

export const hasArbitrumE2eConfig = () =>
    envValue("ARBITRUM_E2E_RPC_URL") !== undefined &&
    envValue("ETHEREUM_E2E_RPC_URL") !== undefined;

export const shouldRunArbitrumE2e = () =>
    process.env.CI === "true" || hasArbitrumE2eConfig();

const waitForRpc = async (rpcUrl: string) => {
    await expect
        .poll(
            async () => {
                try {
                    const response = await fetch(rpcUrl, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            id: 1,
                            jsonrpc: "2.0",
                            method: "eth_chainId",
                            params: [],
                        }),
                    });
                    if (!response.ok) {
                        return false;
                    }

                    const body = (await response.json()) as {
                        result?: string;
                    };
                    return body.result === "0xa4b1";
                } catch {
                    return false;
                }
            },
            { timeout: 60_000, message: "Arbitrum e2e RPC is ready" },
        )
        .toBe(true);
};

const createArbitrum = (): ArbitrumE2e => ({
    chain: arbitrumChain,
    publicClient: arbitrumPublicClient(),
    rpcUrl: ARBITRUM_RPC_URL,
});

export const test = base.extend<ArbitrumFixtures, ArbitrumWorkerFixtures>({
    arbitrumWorker: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            if (!hasArbitrumE2eConfig()) {
                throw new Error("missing Arbitrum e2e RPC config");
            }

            const arbitrum = createArbitrum();
            await waitForRpc(arbitrum.rpcUrl);
            await ensureBackendTbtcLiquidity(arbitrum.publicClient);
            await use(arbitrum);
        },
        { scope: "worker", timeout: rpcTimeout },
    ],

    arbitrum: async ({ arbitrumWorker }, use) => {
        await use(arbitrumWorker);
    },

    // eslint-disable-next-line no-empty-pattern
    recipientAddress: async ({}, use) => {
        await use(privateKeyToAccount(generatePrivateKey()).address);
    },
});

export { expect } from "@playwright/test";
