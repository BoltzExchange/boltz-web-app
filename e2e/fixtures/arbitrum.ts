import { test as base, expect } from "@playwright/test";
import {
    type Address,
    type Chain,
    type PublicClient,
    createPublicClient,
    createWalletClient,
    defineChain,
    getAddress,
    http,
    parseAbi,
    parseEther,
    parseUnits,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const rpcTimeout = 120_000;
// First account from the fixed regtest backend seed.
const regtestBackendWalletAddress = getAddress(
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
);
// TBTC/WETH Uniswap V3 pool at the pinned Arbitrum fork block.
const tbtcFundingSourceAddress = getAddress(
    "0xCb198a55e2a88841E855bE4EAcaad99422416b33",
);
const tbtcTokenAddress = getAddress(
    "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40",
);
const backendTbtcLiquidity = parseUnits("0.1", 18);

const erc20Abi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
]);

const arbitrumRpcUrl = () =>
    `http://127.0.0.1:${process.env.ARBITRUM_E2E_PORT ?? "18545"}`;

const arbitrumE2eChain = defineChain({
    id: 42161,
    name: "Arbitrum One E2E",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [arbitrumRpcUrl()] } },
});

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

const createArbitrum = (): ArbitrumE2e => {
    const rpcUrl = arbitrumRpcUrl();
    return {
        chain: arbitrumE2eChain,
        publicClient: createPublicClient({
            chain: {
                ...arbitrumE2eChain,
                rpcUrls: { default: { http: [rpcUrl] } },
            },
            transport: http(rpcUrl, { timeout: rpcTimeout }),
        }),
        rpcUrl,
    };
};

const tbtcBalance = async (publicClient: PublicClient, owner: Address) =>
    await publicClient.readContract({
        address: tbtcTokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
    });

const ensureBackendTbtcLiquidity = async ({
    chain,
    publicClient,
    rpcUrl,
}: ArbitrumE2e) => {
    const tokenCode = await publicClient.getCode({ address: tbtcTokenAddress });
    if (tokenCode === undefined || tokenCode === "0x") {
        throw new Error("Arbitrum e2e fork is missing the TBTC token contract");
    }

    if (
        (await tbtcBalance(publicClient, regtestBackendWalletAddress)) >=
        backendTbtcLiquidity
    ) {
        return;
    }

    if (
        (await tbtcBalance(publicClient, tbtcFundingSourceAddress)) <
        backendTbtcLiquidity
    ) {
        throw new Error(
            "Arbitrum e2e TBTC funding source has insufficient balance",
        );
    }

    await publicClient.request({
        method: "anvil_setBalance" as never,
        params: [
            tbtcFundingSourceAddress,
            "0x" + parseEther("1").toString(16),
        ] as never,
    });
    await publicClient.request({
        method: "anvil_impersonateAccount" as never,
        params: [tbtcFundingSourceAddress] as never,
    });

    try {
        const walletClient = createWalletClient({
            account: tbtcFundingSourceAddress,
            chain,
            transport: http(rpcUrl, { timeout: rpcTimeout }),
        });
        const hash = await walletClient.writeContract({
            address: tbtcTokenAddress,
            abi: erc20Abi,
            functionName: "transfer",
            args: [regtestBackendWalletAddress, backendTbtcLiquidity],
        });
        await publicClient.waitForTransactionReceipt({ hash });
    } finally {
        await publicClient.request({
            method: "anvil_stopImpersonatingAccount" as never,
            params: [tbtcFundingSourceAddress] as never,
        });
    }
};

export const test = base.extend<ArbitrumFixtures, ArbitrumWorkerFixtures>({
    arbitrumWorker: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            if (!hasArbitrumE2eConfig()) {
                throw new Error("missing Arbitrum e2e RPC config");
            }

            const arbitrum = createArbitrum();
            await waitForRpc(arbitrum.rpcUrl);
            await ensureBackendTbtcLiquidity(arbitrum);
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
