import type { Signer } from "boltz-swaps/interfaces";
import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
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

export const ARBITRUM_RPC_URL = `http://127.0.0.1:${
    process.env.ARBITRUM_E2E_PORT ?? "18545"
}`;
export const GAS_SPONSOR_URL = `http://localhost:${
    process.env.GAS_SPONSOR_EMULATOR_PORT ?? "18547"
}/alchemy`;

const mainnetTbtc = buildMainnetConfig().assets.TBTC;
export const TBTC_TOKEN_ADDRESS = getAddress(mainnetTbtc.token!.address);

const ARBITRUM_CHAIN_ID = mainnetTbtc.network!.chainId!;
const arbitrumChainIdHex = `0x${ARBITRUM_CHAIN_ID.toString(16)}`;

// Regtest backend wallet (first account of the fixed seed)
const backendWalletAddress = getAddress(
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
);
// TBTC/WETH Uniswap pool — the TBTC source on the fork
const tbtcFundingSourceAddress = getAddress(
    "0xCb198a55e2a88841E855bE4EAcaad99422416b33",
);
const backendTbtcLiquidity = parseUnits("0.1", 18);

const erc20Abi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
]);

export const arbitrumChain: Chain = defineChain({
    id: ARBITRUM_CHAIN_ID,
    name: "Arbitrum One E2E",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [ARBITRUM_RPC_URL] } },
});

export const arbitrumPublicClient = (): PublicClient =>
    createPublicClient({
        chain: arbitrumChain,
        transport: http(ARBITRUM_RPC_URL, { timeout: rpcTimeout }),
    });

export const isArbitrumForkReachable = async (): Promise<boolean> => {
    try {
        const res = await fetch(ARBITRUM_RPC_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "eth_chainId",
                params: [],
            }),
            signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
            return false;
        }
        const body = (await res.json()) as { result?: string };
        return body.result === arbitrumChainIdHex;
    } catch {
        return false;
    }
};

export const tokenBalance = (
    client: PublicClient,
    token: Address,
    owner: Address,
): Promise<bigint> =>
    client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
    });

// Throwaway signer; gas is sponsored (EIP-7702) so it needs no ETH.
export const makeArbitrumSigner = (): Signer => {
    const account = privateKeyToAccount(generatePrivateKey());
    const provider = arbitrumPublicClient();
    const wallet = createWalletClient({
        account,
        transport: http(ARBITRUM_RPC_URL, { timeout: rpcTimeout }),
    });
    return Object.assign(wallet, {
        address: account.address,
        provider,
        rdns: "regtest",
    }) as unknown as Signer;
};

// Fund `recipient` with TBTC by impersonating the Uniswap pool on the fork.
export const fundTbtc = async (
    client: PublicClient,
    recipient: Address,
    amount: bigint,
): Promise<void> => {
    const code = await client.getCode({ address: TBTC_TOKEN_ADDRESS });
    if (code === undefined || code === "0x") {
        throw new Error("Arbitrum fork is missing the TBTC token contract");
    }

    await client.request({
        method: "anvil_setBalance" as never,
        params: [
            tbtcFundingSourceAddress,
            `0x${parseEther("1").toString(16)}`,
        ] as never,
    });
    await client.request({
        method: "anvil_impersonateAccount" as never,
        params: [tbtcFundingSourceAddress] as never,
    });

    try {
        const wallet = createWalletClient({
            account: tbtcFundingSourceAddress,
            chain: arbitrumChain,
            transport: http(ARBITRUM_RPC_URL, { timeout: rpcTimeout }),
        });
        const hash = await wallet.writeContract({
            address: TBTC_TOKEN_ADDRESS,
            abi: erc20Abi,
            functionName: "transfer",
            args: [recipient, amount],
        });
        await client.waitForTransactionReceipt({ hash });
    } finally {
        await client.request({
            method: "anvil_stopImpersonatingAccount" as never,
            params: [tbtcFundingSourceAddress] as never,
        });
    }
};

export const ensureBackendTbtcLiquidity = async (
    client: PublicClient,
): Promise<void> => {
    if (
        (await tokenBalance(
            client,
            TBTC_TOKEN_ADDRESS,
            backendWalletAddress,
        )) >= backendTbtcLiquidity
    ) {
        return;
    }
    await fundTbtc(client, backendWalletAddress, backendTbtcLiquidity);
};
