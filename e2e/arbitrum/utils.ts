import type { Page } from "@playwright/test";
import { oftAbi } from "boltz-swaps/oft";
import {
    type Address,
    type Chain,
    type Hex,
    type PublicClient,
    createPublicClient,
    createWalletClient,
    defineChain,
    getAddress,
    http,
    isAddressEqual,
    parseAbi,
    parseEther,
    parseEventLogs,
    parseUnits,
} from "viem";

import { arbitrumChain } from "../../packages/boltz-swaps/integration/arbitrum";
import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { expect, shouldRunArbitrumE2e, test } from "../fixtures/arbitrum";
import { getCurrentSwapId, verifyRescueFile } from "../utils";

export const actionTimeout = 60_000;
export const probeTimeout = 1_000;
export const quoteRequestTimeout = 10_000;
export const testTimeout = 150_000;
export const fullFlowTestTimeout = 300_000;
export const usdt0EthSendAmount = "40";
export const usdt0ArbitrumSendAmount = "40";

const erc20Abi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
]);

const stablesFundingAmount = parseUnits("500", 6);

const ethereumStablesFundingSource = getAddress(
    process.env.STABLES_E2E_USDT0_ETH_FUNDING_SOURCE ??
        "0xF977814e90dA44bFA03b6295A0616a897441aceC",
);

const arbitrumStablesFundingSource = getAddress(
    process.env.STABLES_E2E_USDT0_FUNDING_SOURCE ??
        "0xF977814e90dA44bFA03b6295A0616a897441aceC",
);

export const describeArbitrumE2e = (title: string, callback: () => void) => {
    if (shouldRunArbitrumE2e()) {
        test.describe(title, callback);
    } else {
        test.describe.skip(title, callback);
    }
};

export const ethereumRpcUrl = () =>
    `http://127.0.0.1:${process.env.ETHEREUM_E2E_PORT ?? "18546"}`;

export const ethereumE2eChain = defineChain({
    id: 1,
    name: "Ethereum E2E",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [ethereumRpcUrl()] } },
});

export const getRegtestTokenAddress = (
    asset: "USDT0" | "USDT0-ETH" | "TBTC",
): Address => {
    const address = config.assets?.[asset]?.token?.address;
    if (address === undefined) {
        throw new Error(`missing ${asset} token address`);
    }

    return getAddress(address);
};

export const createEthereumClient = () => {
    const rpcUrl = ethereumRpcUrl();
    return createPublicClient({
        chain: {
            ...ethereumE2eChain,
            rpcUrls: { default: { http: [rpcUrl] } },
        },
        transport: http(rpcUrl, { timeout: actionTimeout }),
    });
};

export const waitForEthereumRpc = async (publicClient: PublicClient) => {
    await expect
        .poll(
            async () => {
                try {
                    return await publicClient.getChainId();
                } catch {
                    return 0;
                }
            },
            {
                timeout: actionTimeout,
                message: "Ethereum e2e RPC is ready",
            },
        )
        .toBe(ethereumE2eChain.id);
};

export const getStablesE2eAccountIndex = () => {
    const index = Number(process.env.STABLES_E2E_ACCOUNT_INDEX ?? "1");
    if (!Number.isInteger(index) || index < 0) {
        throw new Error(
            "STABLES_E2E_ACCOUNT_INDEX must be a non-negative integer",
        );
    }

    return index;
};

export const getStablesE2eWalletAddress = async (
    publicClient: PublicClient,
): Promise<Address> => {
    const accounts = (await publicClient.request({
        method: "eth_accounts",
        params: [],
    } as never)) as Address[];
    const walletAddress = accounts[getStablesE2eAccountIndex()];
    if (walletAddress === undefined) {
        throw new Error("STABLES_E2E_ACCOUNT_INDEX is not available in Anvil");
    }

    return getAddress(walletAddress);
};

export const getCodeFreeStablesE2eWalletAddress = async (
    publicClient: PublicClient,
): Promise<Address> => {
    const accounts = (await publicClient.request({
        method: "eth_accounts",
        params: [],
    } as never)) as Address[];

    for (const account of accounts) {
        const address = getAddress(account);
        const code = await publicClient.getCode({ address });
        if (code === undefined || code === "0x") {
            return address;
        }
    }

    throw new Error("no code-free Anvil account is available");
};

export const waitForDexQuote = async (args: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    label: string;
}) => {
    const params = new URLSearchParams({
        tokenIn: args.tokenIn,
        tokenOut: args.tokenOut,
        amountIn: args.amountIn.toString(),
    });
    const url = `${config.apiUrl.normal}/v2/quote/ARB/in?${params}`;

    await expect
        .poll(
            async () => {
                try {
                    const response = await fetch(url, {
                        signal: AbortSignal.timeout(quoteRequestTimeout),
                    });
                    if (!response.ok) {
                        return 0;
                    }
                    const quotes = await response.json();
                    return Array.isArray(quotes) ? quotes.length : 0;
                } catch {
                    return 0;
                }
            },
            {
                timeout: actionTimeout,
                message: `quote not ready for ${args.label}`,
            },
        )
        .toBeGreaterThan(0);
};

export type StoredBridgeSwap = {
    bridge?: { txHash?: Hex };
};

export const getStoredSwap = async <T>(
    page: Page,
    id: string,
): Promise<T | null> =>
    await page.evaluate(
        async ({ id }) =>
            await new Promise<T | null>((resolve, reject) => {
                const request = indexedDB.open("swaps");
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const transaction = db.transaction(
                        "keyvaluepairs",
                        "readonly",
                    );
                    const getRequest = transaction
                        .objectStore("keyvaluepairs")
                        .get(id);
                    getRequest.onsuccess = () => {
                        db.close();
                        resolve((getRequest.result as T | undefined) ?? null);
                    };
                    getRequest.onerror = () => reject(getRequest.error);
                };
            }),
        { id },
    );

export const waitForBridgeTxHash = async (
    page: Page,
    id: string,
): Promise<Hex> => {
    await expect
        .poll(
            async () =>
                (await getStoredSwap<StoredBridgeSwap>(page, id))?.bridge
                    ?.txHash,
            {
                timeout: actionTimeout,
            },
        )
        .toMatch(/^0x[0-9a-fA-F]{64}$/);

    return (await getStoredSwap<StoredBridgeSwap>(page, id))!.bridge!.txHash!;
};

const bridgeCanonicalAsset = (asset: string) =>
    asset.startsWith("USDT0") ? "USDT0" : asset;

const chooseAsset = async (page: Page, asset: string) => {
    const canonical = bridgeCanonicalAsset(asset);
    await page.getByTestId(`select-${canonical}`).click();

    if (
        canonical !== asset ||
        (await page
            .getByTestId("network-back")
            .isVisible({ timeout: probeTimeout })
            .catch(() => false))
    ) {
        await page.getByTestId(`select-${asset}`).click();
    }

    await expect(page.locator(".asset-select-overlay")).toBeHidden({
        timeout: actionTimeout,
    });
};

export const selectAssets = async (
    page: Page,
    sendAsset: string,
    receiveAsset: string,
) => {
    const sendSelector = page.getByTestId("asset-send");
    const receiveSelector = page.getByTestId("asset-receive");

    await expect(sendSelector).toBeVisible({ timeout: actionTimeout });
    await sendSelector.click();
    await chooseAsset(page, sendAsset);
    await expect(receiveSelector).toBeVisible({ timeout: actionTimeout });
    await receiveSelector.click();
    await chooseAsset(page, receiveAsset);
};

export const createSwap = async (
    page: Page,
    sendAsset: string,
    receiveAsset: string,
    destinationAddress: string,
    sendAmount: string,
    options?: { skipGoto?: boolean; walletAddress?: Address },
) => {
    if (options?.skipGoto !== true) {
        await page.goto("/swap");
    }
    await selectAssets(page, sendAsset, receiveAsset);
    await page.getByTestId("onchainAddress").fill(destinationAddress);
    await page.getByTestId("sendAmount").fill(sendAmount);

    const receiveAmount = page.getByTestId("receiveAmount");
    await expect(receiveAmount).not.toHaveValue("", {
        timeout: actionTimeout,
    });
    await expect(receiveAmount).not.toHaveValue("0", {
        timeout: actionTimeout,
    });

    if (options?.walletAddress !== undefined) {
        await connectWallet(page, options.walletAddress);
    }

    const createButton = page.getByTestId("create-swap-button");
    await expect(createButton).toBeEnabled({ timeout: actionTimeout });
    await createButton.click();

    const downloadButton = page.getByRole("button", {
        name: dict.en.download_new_key,
    });
    const swapReady = page
        .locator("div[data-status='swap.created']")
        .or(page.locator("div[data-status='invoice.set']"));

    await expect(swapReady.or(downloadButton)).toBeVisible({
        timeout: actionTimeout,
    });
    if (await downloadButton.isVisible().catch(() => false)) {
        await verifyRescueFile(page);
    }
    await expect(swapReady).toBeVisible({ timeout: actionTimeout });

    return getCurrentSwapId(page);
};

export const getTokenBalance = async (
    publicClient: PublicClient,
    token: Address,
    owner: Address,
) =>
    await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
    });

const fundStablesE2eWallet = async ({
    asset,
    chain,
    fundingSource,
    minimumAmount,
    publicClient,
    rpcUrl,
    wallet,
}: {
    asset: "USDT0" | "USDT0-ETH";
    chain: Chain;
    fundingSource: Address;
    minimumAmount: bigint;
    publicClient: PublicClient;
    rpcUrl: string;
    wallet: Address;
}) => {
    const token = getRegtestTokenAddress(asset);
    const tokenCode = await publicClient.getCode({ address: token });
    if (tokenCode === undefined || tokenCode === "0x") {
        throw new Error(`${asset} e2e fork is missing the token contract`);
    }

    await publicClient.request({
        method: "anvil_setBalance" as never,
        params: [wallet, "0x" + parseEther("10").toString(16)] as never,
    });

    if ((await getTokenBalance(publicClient, token, wallet)) >= minimumAmount) {
        return;
    }

    await publicClient.request({
        method: "anvil_setBalance" as never,
        params: [fundingSource, "0x" + parseEther("1").toString(16)] as never,
    });
    await publicClient.request({
        method: "anvil_impersonateAccount" as never,
        params: [fundingSource] as never,
    });

    try {
        const walletClient = createWalletClient({
            account: fundingSource,
            chain,
            transport: http(rpcUrl, { timeout: actionTimeout }),
        });
        const hash = await walletClient.writeContract({
            address: token,
            abi: erc20Abi,
            functionName: "transfer",
            args: [wallet, stablesFundingAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash });
    } finally {
        await publicClient.request({
            method: "anvil_stopImpersonatingAccount" as never,
            params: [fundingSource] as never,
        });
    }
};

export const fundEthereumStablesE2eWallet = async (
    publicClient: PublicClient,
    wallet: Address,
) =>
    await fundStablesE2eWallet({
        asset: "USDT0-ETH",
        chain: ethereumE2eChain,
        fundingSource: ethereumStablesFundingSource,
        minimumAmount: parseUnits(usdt0EthSendAmount, 6),
        publicClient,
        rpcUrl: ethereumRpcUrl(),
        wallet,
    });

export const fundArbitrumStablesE2eWallet = async (
    publicClient: PublicClient,
    wallet: Address,
) =>
    await fundStablesE2eWallet({
        asset: "USDT0",
        chain: arbitrumChain,
        fundingSource: arbitrumStablesFundingSource,
        minimumAmount: parseUnits(usdt0ArbitrumSendAmount, 6),
        publicClient,
        rpcUrl: arbitrumChain.rpcUrls.default.http[0],
        wallet,
    });

export const expectEthereumWalletReady = async (
    publicClient: PublicClient,
    owner: Address,
) => {
    const token = getRegtestTokenAddress("USDT0-ETH");

    expect(await publicClient.getBalance({ address: owner })).toBeGreaterThan(
        0n,
    );
    expect(
        await getTokenBalance(publicClient, token, owner),
    ).toBeGreaterThanOrEqual(parseUnits(usdt0EthSendAmount, 6));
};

export const expectArbitrumWalletReady = async (
    publicClient: PublicClient,
    owner: Address,
) => {
    const token = getRegtestTokenAddress("USDT0");

    expect(await publicClient.getBalance({ address: owner })).toBeGreaterThan(
        0n,
    );
    expect(
        await getTokenBalance(publicClient, token, owner),
    ).toBeGreaterThanOrEqual(parseUnits(usdt0ArbitrumSendAmount, 6));
};

export const connectWallet = async (page: Page, walletAddress: Address) => {
    const connect = page.getByRole("button", {
        name: new RegExp(dict.en.connect_wallet, "i"),
    });
    const connectedAddress = page.locator(`text=${walletAddress.slice(0, 8)}`);

    await expect(connectedAddress.or(connect)).toBeVisible({
        timeout: actionTimeout,
    });

    if (await connect.isVisible().catch(() => false)) {
        await connect.click();

        const modal = page.locator("[data-testid='wallet-connect-modal']");
        if (
            await modal.isVisible({ timeout: probeTimeout }).catch(() => false)
        ) {
            await modal
                .locator(".provider-modal-entry-wrapper")
                .filter({ hasText: /metamask|browser native/i })
                .first()
                .click();
        }
    }

    await expect(connectedAddress).toBeVisible({
        timeout: actionTimeout,
    });
};

export const clickSendBridge = async (page: Page, walletAddress: Address) => {
    await connectWallet(page, walletAddress);

    const approve = page.getByRole("button", { name: /^approve$/i });
    const send = page.getByRole("button", { name: /^send$/i });

    await expect(send.or(approve)).toBeVisible({
        timeout: actionTimeout,
    });
    if (await approve.isVisible().catch(() => false)) {
        await approve.click();
    }

    await expect(send).toBeEnabled({ timeout: actionTimeout });
    await send.click();
};

export const expectOftSendTx = async (
    publicClient: PublicClient,
    txHash: Hex,
    walletAddress: Address,
) => {
    const transaction = await publicClient.getTransaction({
        hash: txHash,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: actionTimeout,
    });
    expect(receipt.status).toBe("success");

    const [sent] = parseEventLogs({
        abi: oftAbi,
        eventName: "OFTSent",
        logs: receipt.logs,
    });

    expect(sent).toBeDefined();
    expect(isAddressEqual(sent.address, getAddress(transaction.to!))).toBe(
        true,
    );
    expect(isAddressEqual(sent.args.fromAddress, walletAddress)).toBe(true);
    expect(sent.args.amountSentLD).toBeGreaterThan(0n);
    expect(sent.args.amountReceivedLD).toBeGreaterThan(0n);
};
