import { test as base } from "@playwright/test";
import {
    createPublicClient,
    createWalletClient,
    defineChain,
    http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rskRegtest = defineChain({
    id: 33,
    name: "Anvil",
    nativeCurrency: { name: "RBTC", symbol: "RBTC", decimals: 18 },
    rpcUrls: { default: { http: ["http://localhost:8545"] } },
});

const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

type EthereumFixtures = {
    walletClient: ReturnType<typeof createWalletClient>;
    injectProvider: () => Promise<void>;
};

export const test = base.extend<EthereumFixtures>({
    // eslint-disable-next-line no-empty-pattern
    walletClient: async ({}, use) => {
        const client = createWalletClient({
            account,
            chain: rskRegtest,
            transport: http(),
        });
        await use(client);
    },

    injectProvider: async ({ page, walletClient }, use) => {
        const inject = async () => {
            const publicClient = createPublicClient({
                chain: rskRegtest,
                transport: http(),
            });

            await page.exposeFunction(
                "__rpc",
                async (method: string, params: unknown[]) => {
                    return await publicClient.request({
                        method,
                        params,
                    } as never);
                },
            );

            await page.exposeFunction(
                "__sendTx",
                async (tx: {
                    to?: string;
                    value?: string;
                    data?: string;
                    gas?: string;
                }) => {
                    return await walletClient.sendTransaction({
                        account,
                        chain: rskRegtest,
                        to: tx.to as `0x${string}`,
                        value: tx.value ? BigInt(tx.value) : undefined,
                        data: tx.data as `0x${string}`,
                        gas: tx.gas ? BigInt(tx.gas) : undefined,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any);
                },
            );

            const walletAddress = walletClient.account.address;
            const chainIdHex = "0x" + rskRegtest.id.toString(16);

            await page.addInitScript(
                ({ addr, chainId }) => {
                    const listeners: Record<
                        string,
                        Array<(...args: unknown[]) => void>
                    > = {};

                    const provider = {
                        isMetaMask: true,
                        isConnected: () => true,
                        chainId,
                        selectedAddress: addr,

                        request: async ({
                            method,
                            params,
                        }: {
                            method: string;
                            params?: unknown[];
                        }) => {
                            switch (method) {
                                case "eth_requestAccounts":
                                case "eth_accounts":
                                    return [addr];
                                case "eth_chainId":
                                    return chainId;
                                case "net_version":
                                    return String(parseInt(chainId, 16));
                                case "wallet_switchEthereumChain":
                                    setTimeout(() => {
                                        (
                                            listeners["chainChanged"] || []
                                        ).forEach((cb) => cb(chainId));
                                    }, 100);
                                    return null;
                                case "wallet_addEthereumChain":
                                    return null;
                                case "eth_sendTransaction":
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
                                    return await (window as any).__sendTx(
                                        (params as unknown[])[0],
                                    );
                                default:
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
                                    return await (window as any).__rpc(
                                        method,
                                        params || [],
                                    );
                            }
                        },

                        send: (method: string, params?: unknown[]) =>
                            provider.request({ method, params }),

                        on: (
                            event: string,
                            callback: (...args: unknown[]) => void,
                        ) => {
                            if (!listeners[event]) listeners[event] = [];
                            listeners[event].push(callback);
                        },
                        removeListener: (
                            event: string,
                            callback: (...args: unknown[]) => void,
                        ) => {
                            if (listeners[event]) {
                                listeners[event] = listeners[event].filter(
                                    (cb) => cb !== callback,
                                );
                            }
                        },
                    };

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (window as any).ethereum = provider;

                    const announceProvider = () => {
                        window.dispatchEvent(
                            new CustomEvent("eip6963:announceProvider", {
                                detail: Object.freeze({
                                    info: {
                                        uuid: "playwright-mock",
                                        name: "MetaMask",
                                        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
                                        rdns: "io.metamask",
                                    },
                                    provider,
                                }),
                            }),
                        );
                    };

                    window.addEventListener(
                        "eip6963:requestProvider",
                        announceProvider,
                    );
                    announceProvider();
                },
                { addr: walletAddress, chainId: chainIdHex },
            );
        };

        await use(inject);
    },
});

export { expect } from "@playwright/test";
