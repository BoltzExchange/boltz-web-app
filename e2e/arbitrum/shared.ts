import type { Locator, Page, Response } from "@playwright/test";
import { oftAbi } from "boltz-swaps/oft";
import {
    type Address,
    type Hex,
    type PublicClient,
    type WalletClient,
    createPublicClient,
    createWalletClient,
    defineChain,
    encodePacked,
    getAddress,
    http,
    isAddressEqual,
    padHex,
    parseAbi,
    parseEther,
    parseEventLogs,
    parseUnits,
    slice,
    zeroAddress,
} from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { expect, shouldRunArbitrumE2e, test } from "../fixtures/arbitrum";
import { getCurrentSwapId, verifyRescueFile } from "../utils";

export { expect, shouldRunArbitrumE2e, test };

export const describeArbitrumE2e = (title: string, callback: () => void) => {
    if (shouldRunArbitrumE2e()) {
        test.describe(title, callback);
    } else {
        test.describe.skip(title, callback);
    }
};

export const erc20Abi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
]);

export const lbtcSendAmount = "0.001";
export const usdt0EthSendAmount = "40";
export const usdt0ArbitrumSendAmount = "40";
export const actionTimeout = 60_000;
export const probeTimeout = 1_000;
export const quoteRequestTimeout = 10_000;
export const testTimeout = 150_000;
export const fullFlowTestTimeout = 300_000;

const isVisibleWithin = (locator: Locator, timeout = probeTimeout) =>
    locator
        .waitFor({ state: "visible", timeout })
        .then(() => true)
        .catch(() => false);

export const stablesFundingSource = getAddress(
    process.env.STABLES_E2E_USDT0_ETH_FUNDING_SOURCE ??
        "0xF977814e90dA44bFA03b6295A0616a897441aceC",
);
export const arbitrumStablesFundingSource = getAddress(
    process.env.STABLES_E2E_USDT0_FUNDING_SOURCE ??
        "0xF977814e90dA44bFA03b6295A0616a897441aceC",
);
export const stablesFundingAmount = parseUnits("500", 6);

export const arbitrumRpcUrl = () =>
    `http://127.0.0.1:${process.env.ARBITRUM_E2E_PORT ?? "18545"}`;

export const ethereumRpcUrl = () =>
    `http://127.0.0.1:${process.env.ETHEREUM_E2E_PORT ?? "18546"}`;

export const arbitrumE2eChain = defineChain({
    id: 42161,
    name: "Arbitrum One E2E",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [arbitrumRpcUrl()] } },
});

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

type StoredSwap = {
    dex?: {
        position?: string;
        quoteAmount?: number | string;
    };
    bridge?: { txHash?: Hex };
    lockupTx?: Hex;
    commitmentLockupTxHash?: Hex;
    originalDestination?: string;
};

export const getStoredSwap = async (
    page: Page,
    id: string,
): Promise<StoredSwap | null> =>
    await page.evaluate(
        async ({ id }) => {
            const databases = await indexedDB.databases();
            if (!databases.some((db) => db.name === "swaps")) {
                return null;
            }

            return await new Promise<StoredSwap | null>((resolve, reject) => {
                const request = indexedDB.open("swaps");
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    // Store is created lazily; guard so a missing-store throw can't hang the promise.
                    if (!db.objectStoreNames.contains("keyvaluepairs")) {
                        db.close();
                        resolve(null);
                        return;
                    }
                    try {
                        const transaction = db.transaction(
                            "keyvaluepairs",
                            "readonly",
                        );
                        transaction.onerror = () => {
                            db.close();
                            reject(transaction.error);
                        };
                        const getRequest = transaction
                            .objectStore("keyvaluepairs")
                            .get(id);
                        getRequest.onsuccess = () => {
                            db.close();
                            resolve(getRequest.result ?? null);
                        };
                        getRequest.onerror = () => {
                            db.close();
                            reject(getRequest.error);
                        };
                    } catch (error) {
                        db.close();
                        reject(error);
                    }
                };
            });
        },
        { id },
    );

export const waitForBridgeTxHash = async (
    page: Page,
    id: string,
): Promise<Hex> => {
    await expect
        .poll(async () => (await getStoredSwap(page, id))?.bridge?.txHash, {
            timeout: actionTimeout,
        })
        .toMatch(/^0x[0-9a-fA-F]{64}$/);

    return (await getStoredSwap(page, id))!.bridge!.txHash!;
};

export const waitForLockupTxHash = async (
    page: Page,
    id: string,
): Promise<Hex> => {
    await expect
        .poll(
            async () => {
                const swap = await getStoredSwap(page, id);
                return swap?.lockupTx ?? swap?.commitmentLockupTxHash;
            },
            { timeout: actionTimeout },
        )
        .toMatch(/^0x[0-9a-fA-F]{64}$/);

    const swap = await getStoredSwap(page, id);
    return (swap!.lockupTx ?? swap!.commitmentLockupTxHash)!;
};

const bridgeCanonicalAsset = (asset: string) =>
    asset.startsWith("USDT0") ? "USDT0" : asset;

export const chooseAsset = async (page: Page, asset: string) => {
    const canonical = bridgeCanonicalAsset(asset);
    await page.getByTestId(`select-${canonical}`).click();

    if (
        canonical !== asset ||
        (await isVisibleWithin(page.getByTestId("network-back")))
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
    const assetSelectors = page.locator("div[class^='asset asset-']");
    await assetSelectors.first().click();
    await chooseAsset(page, sendAsset);
    await assetSelectors.last().click();
    await chooseAsset(page, receiveAsset);
};

export const saveRescueFile = async (page: Page, path: string) => {
    const downloadPromise = page.waitForEvent("download", {
        timeout: actionTimeout,
    });
    await page.getByRole("button", { name: dict.en.download_new_key }).click();
    await (await downloadPromise).saveAs(path);

    const upload = page.getByTestId("rescueFileUpload");
    await expect(upload).toBeVisible({ timeout: actionTimeout });
    await upload.setInputFiles(path);
    await expect(upload).toBeHidden({ timeout: actionTimeout });
};

export const createSwap = async (
    page: Page,
    sendAsset: string,
    receiveAsset: string,
    destinationAddress: string,
    sendAmount: string,
    options?: {
        skipGoto?: boolean;
        walletAddress?: Address;
        rescueFilePath?: string;
    },
) => {
    if (options?.skipGoto !== true) {
        await page.goto("/");
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

    await expect(swapReady.or(downloadButton).first()).toBeVisible({
        timeout: actionTimeout,
    });
    if (await downloadButton.isVisible().catch(() => false)) {
        if (options?.rescueFilePath !== undefined) {
            await saveRescueFile(page, options.rescueFilePath);
        } else {
            await verifyRescueFile(page);
        }
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

export const fundErc20FromWhale = async (args: {
    publicClient: PublicClient;
    chain: typeof arbitrumE2eChain;
    rpcUrl: string;
    token: Address;
    whale: Address;
    recipient: Address;
    amount: bigint;
    gasRecipientAmount?: bigint;
}) => {
    const { publicClient, chain, rpcUrl, token, whale, recipient, amount } =
        args;

    const tokenCode = await publicClient.getCode({ address: token });
    if (tokenCode === undefined || tokenCode === "0x") {
        throw new Error(`fork is missing token contract ${token}`);
    }

    // Fund gas before the balance early-return so later steps can always pay.
    await publicClient.request({
        method: "anvil_setBalance" as never,
        params: [
            recipient,
            "0x" + (args.gasRecipientAmount ?? parseEther("10")).toString(16),
        ] as never,
    });

    if ((await getTokenBalance(publicClient, token, recipient)) >= amount) {
        return;
    }

    if ((await getTokenBalance(publicClient, token, whale)) < amount) {
        throw new Error(`funding whale ${whale} has insufficient balance`);
    }

    await publicClient.request({
        method: "anvil_setBalance" as never,
        params: [whale, "0x" + parseEther("1").toString(16)] as never,
    });
    await publicClient.request({
        method: "anvil_impersonateAccount" as never,
        params: [whale] as never,
    });

    try {
        const walletClient = createWalletClient({
            account: whale,
            chain,
            transport: http(rpcUrl, { timeout: actionTimeout }),
        });
        const hash = await walletClient.writeContract({
            address: token,
            abi: erc20Abi,
            functionName: "transfer",
            args: [recipient, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash });
    } finally {
        await publicClient.request({
            method: "anvil_stopImpersonatingAccount" as never,
            params: [whale] as never,
        });
    }
};

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
    chain: typeof arbitrumE2eChain | typeof ethereumE2eChain;
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
        fundingSource: stablesFundingSource,
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
        chain: arbitrumE2eChain,
        fundingSource: arbitrumStablesFundingSource,
        minimumAmount: parseUnits(usdt0ArbitrumSendAmount, 6),
        publicClient,
        rpcUrl: arbitrumRpcUrl(),
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

// Clears an EIP-7702 delegation inherited from forked mainnet state, which would
// otherwise make Permit2 verify the lockup permit via EIP-1271 instead of ECDSA.
export const clearEoaDelegation = async (
    publicClient: PublicClient,
    address: Address,
) => {
    await publicClient.request({
        method: "anvil_setCode" as never,
        params: [address, "0x"] as never,
    });
};

// Mines blocks on the Arbitrum fork (anvil-arb), not the local RSK Anvil.
export const mineArbitrumBlocks = async (
    publicClient: PublicClient,
    blocks: number,
) => {
    await publicClient.request({
        method: "anvil_mine" as never,
        params: ["0x" + blocks.toString(16)] as never,
    });
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
        if (await isVisibleWithin(modal)) {
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

export const approveAndSend = async (page: Page, walletAddress: Address) => {
    await connectWallet(page, walletAddress);

    const approve = page.getByRole("button", { name: /^approve$/i });
    const send = page.getByRole("button", { name: /^send$/i });

    await expect(send.or(approve).first()).toBeVisible({
        timeout: actionTimeout,
    });
    if (await approve.isVisible().catch(() => false)) {
        await approve.click();
    }

    await expect(send).toBeEnabled({ timeout: actionTimeout });
    await send.click();
};

export const clickSendBridge = approveAndSend;

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

const oAppAbi = parseAbi([
    "function endpoint() view returns (address)",
    "function peers(uint32 eid) view returns (bytes32)",
    "function lzReceive((uint32 srcEid,bytes32 sender,uint64 nonce) origin,bytes32 guid,bytes message,address executor,bytes extraData) payable",
]);
const endpointAbi = parseAbi(["function eid() view returns (uint32)"]);

export const deliverOft = async (
    sourceClient: PublicClient,
    destinationClient: PublicClient,
    sourceTxHash: Hex,
    recipient: Address,
    destinationRpcUrl: string,
) => {
    const receipt = await sourceClient.waitForTransactionReceipt({
        hash: sourceTxHash,
        timeout: actionTimeout,
    });
    const [sent] = parseEventLogs({
        abi: oftAbi,
        eventName: "OFTSent",
        logs: receipt.logs,
    });
    if (sent === undefined) {
        throw new Error("missing OFTSent event");
    }

    const sourceContract = getAddress(sent.address);
    const sourceEndpoint = await sourceClient.readContract({
        address: sourceContract,
        abi: oAppAbi,
        functionName: "endpoint",
    });
    const [sourceEid, destinationPeer] = await Promise.all([
        sourceClient.readContract({
            address: sourceEndpoint,
            abi: endpointAbi,
            functionName: "eid",
        }),
        sourceClient.readContract({
            address: sourceContract,
            abi: oAppAbi,
            functionName: "peers",
            args: [sent.args.dstEid],
        }),
    ]);
    const destinationContract = getAddress(slice(destinationPeer, 12));
    const destinationEndpoint = await destinationClient.readContract({
        address: destinationContract,
        abi: oAppAbi,
        functionName: "endpoint",
    });

    await destinationClient.request({
        method: "anvil_setBalance" as never,
        params: [
            destinationEndpoint,
            `0x${parseEther("10").toString(16)}`,
        ] as never,
    });
    await destinationClient.request({
        method: "anvil_impersonateAccount" as never,
        params: [destinationEndpoint] as never,
    });

    try {
        const endpointWallet = createWalletClient({
            account: destinationEndpoint,
            chain: arbitrumE2eChain,
            transport: http(destinationRpcUrl, { timeout: actionTimeout }),
        });
        const hash = await endpointWallet.writeContract({
            address: destinationContract,
            abi: oAppAbi,
            functionName: "lzReceive",
            args: [
                {
                    srcEid: sourceEid,
                    sender: padHex(sourceContract, { size: 32 }),
                    nonce: 1n,
                },
                sent.args.guid,
                encodePacked(
                    ["bytes32", "uint64"],
                    [
                        padHex(recipient, { size: 32 }),
                        sent.args.amountReceivedLD,
                    ],
                ),
                zeroAddress,
                "0x",
            ],
        });
        const destinationReceipt =
            await destinationClient.waitForTransactionReceipt({
                hash,
                timeout: actionTimeout,
            });
        const [received] = parseEventLogs({
            abi: oftAbi,
            eventName: "OFTReceived",
            logs: destinationReceipt.logs,
        });
        expect(received).toBeDefined();
        expect(isAddressEqual(received.args.toAddress, recipient)).toBe(true);
    } finally {
        await destinationClient.request({
            method: "anvil_stopImpersonatingAccount" as never,
            params: [destinationEndpoint] as never,
        });
    }
};

export const getArbitrumWalletAddress = async (
    pageClient: PublicClient,
    index: number,
): Promise<Address> => {
    const accounts = (await pageClient.request({
        method: "eth_accounts",
        params: [],
    } as never)) as Address[];
    const walletAddress = accounts[index];
    if (walletAddress === undefined) {
        throw new Error(`Arbitrum account #${index} is not available in Anvil`);
    }

    return getAddress(walletAddress);
};

export const clearBrowserStorage = async (page: Page) => {
    await page.evaluate(async () => {
        window.localStorage.clear();

        await Promise.all(
            ["swaps", "lastUsedEvmIndex"].map(
                (name) =>
                    new Promise<void>((resolve, reject) => {
                        const request = indexedDB.deleteDatabase(name);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                        request.onblocked = () =>
                            reject(new Error(`deleting ${name} was blocked`));
                    }),
            ),
        );
    });
};

const isMetadataPatchResponse = (response: Response, swapId: string) => {
    const request = response.request();
    if (request.method() !== "PATCH") {
        return false;
    }

    return new URL(response.url()).pathname === `/v2/swap/${swapId}/metadata`;
};

export const waitForMetadataPatch = async (page: Page, swapId: string) => {
    const response = await page.waitForResponse(
        (res) => isMetadataPatchResponse(res, swapId),
        { timeout: actionTimeout },
    );

    expect(response.ok()).toBe(true);
    const body = response.request().postDataJSON() as { metadata?: unknown };
    expect(typeof body.metadata).toBe("string");
    expect(body.metadata).toMatch(/^[0-9a-f]+$/);

    return response;
};

const hasRestoredMetadataForSwap = (body: unknown, swapId: string) =>
    Array.isArray(body) &&
    body.some((value) => {
        if (typeof value !== "object" || value === null) {
            return false;
        }

        const swap = value as { id?: unknown; metadata?: unknown };
        return (
            swap.id === swapId &&
            typeof swap.metadata === "string" &&
            /^[0-9a-f]+$/.test(swap.metadata)
        );
    });

export const waitForMetadataRestore = async (page: Page, swapId: string) => {
    await page.waitForResponse(
        async (response) => {
            const request = response.request();
            if (
                request.method() !== "POST" ||
                new URL(response.url()).pathname !== "/v2/swap/restore" ||
                !response.ok()
            ) {
                return false;
            }

            return hasRestoredMetadataForSwap(
                await response.json().catch(() => undefined),
                swapId,
            );
        },
        { timeout: actionTimeout },
    );
};

const fetchPairHash = async (
    endpoint: "chain" | "reverse",
    from: string,
    to: string,
) => {
    const response = await fetch(
        `${config.apiUrl.normal}/v2/swap/${endpoint}`,
        {
            signal: AbortSignal.timeout(10_000),
        },
    );
    if (!response.ok) {
        return undefined;
    }

    const pairs = (await response.json()) as Record<
        string,
        Record<string, { hash?: unknown }>
    >;
    const hash = pairs[from]?.[to]?.hash;
    return typeof hash === "string" ? hash : undefined;
};

export const waitForStablePairHash = async (
    endpoint: "chain" | "reverse",
    from: string,
    to: string,
) => {
    let previous: string | undefined;
    let stableReads = 0;

    await expect
        .poll(
            async () => {
                const hash = await fetchPairHash(endpoint, from, to).catch(
                    () => undefined,
                );
                if (hash === undefined) {
                    previous = undefined;
                    stableReads = 0;
                    return "";
                }

                if (hash === previous) {
                    stableReads += 1;
                } else {
                    previous = hash;
                    stableReads = 0;
                }

                return stableReads >= 2 ? hash : "";
            },
            {
                timeout: actionTimeout,
                intervals: [1_000, 2_000, 2_000],
                message: `${from} -> ${to} ${endpoint} pair hash is stable`,
            },
        )
        .toMatch(/^[0-9a-f]{64}$/);
};

export const expectAssetPair = async (
    item: Locator,
    from: string,
    to: string,
) => {
    await expect(item.locator(`.asset[data-asset='${from}']`)).toBeVisible();
    await expect(item.locator(`.asset[data-asset='${to}']`)).toBeVisible();
};

export const startExternalRescue = async (page: Page) => {
    await page.goto("/rescue");
};

export const scanAndSelectExternalResult = async ({
    page,
    swapId,
    walletAddress,
    rescueFilePath,
    action,
    assets,
}: {
    page: Page;
    swapId: string;
    // Omitted: the scan runs with only the rescue key
    walletAddress?: Address;
    rescueFilePath: string;
    action: string;
    assets: [string, string];
}) => {
    const resultItems = page.locator(".rescue-external-results .swaplist-item");
    const actionItem = resultItems
        .filter({
            has: page.getByRole("link", {
                name: action,
                exact: true,
            }),
        })
        .first();

    await expect(async () => {
        await startExternalRescue(page);
        await page.getByTestId("refundUpload").setInputFiles(rescueFilePath);
        if (walletAddress !== undefined) {
            await connectWallet(page, walletAddress);
        }
        const metadataRestore = waitForMetadataRestore(page, swapId);
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
        await metadataRestore;

        await expect(actionItem).toBeVisible({ timeout: actionTimeout });
        await expect(resultItems).toHaveCount(1);
        await expectAssetPair(actionItem, ...assets);
    }).toPass({
        timeout: actionTimeout * 2,
        intervals: [2_000, 5_000, 10_000],
    });

    await actionItem.click();
};

export type { Address, Hex, PublicClient, WalletClient };
