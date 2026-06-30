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

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { expect, shouldRunArbitrumE2e, test } from "../fixtures/arbitrum";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
    getCurrentSwapId,
    getLiquidAddress,
    verifyRescueFile,
} from "../utils";

const describeArbitrumE2e = (title: string, callback: () => void) => {
    if (shouldRunArbitrumE2e()) {
        test.describe(title, callback);
    } else {
        test.describe.skip(title, callback);
    }
};

const erc20Abi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
]);

const lbtcSendAmount = "0.001";
const usdt0EthSendAmount = "40";
const actionTimeout = 60_000;
const probeTimeout = 1_000;
const quoteRequestTimeout = 10_000;
const testTimeout = 150_000;

// Whale holding USDT0-ETH (mainnet USDT) on the Ethereum fork; impersonated to
// fund the test wallet, mirroring the backend TBTC funding in the fixture.
const stablesFundingSource = getAddress(
    process.env.STABLES_E2E_USDT0_ETH_FUNDING_SOURCE ??
        "0xF977814e90dA44bFA03b6295A0616a897441aceC",
);
const stablesFundingAmount = parseUnits("500", 6);

const ethereumRpcUrl = () =>
    `http://127.0.0.1:${process.env.ETHEREUM_E2E_PORT ?? "18546"}`;

const ethereumE2eChain = defineChain({
    id: 1,
    name: "Ethereum E2E",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [ethereumRpcUrl()] } },
});

const getRegtestTokenAddress = (
    asset: "USDT0" | "USDT0-ETH" | "TBTC",
): Address => {
    const address = config.assets?.[asset]?.token?.address;
    if (address === undefined) {
        throw new Error(`missing ${asset} token address`);
    }

    return getAddress(address);
};

const createEthereumClient = () => {
    const rpcUrl = ethereumRpcUrl();
    return createPublicClient({
        chain: {
            ...ethereumE2eChain,
            rpcUrls: { default: { http: [rpcUrl] } },
        },
        transport: http(rpcUrl, { timeout: actionTimeout }),
    });
};

const waitForEthereumRpc = async (publicClient: PublicClient) => {
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

const getStablesE2eAccountIndex = () => {
    const index = Number(process.env.STABLES_E2E_ACCOUNT_INDEX ?? "1");
    if (!Number.isInteger(index) || index < 0) {
        throw new Error(
            "STABLES_E2E_ACCOUNT_INDEX must be a non-negative integer",
        );
    }

    return index;
};

const getStablesE2eWalletAddress = async (
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

const waitForDexQuote = async (args: {
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

type StoredBridgeSwap = {
    bridge?: { txHash?: Hex };
};

const getStoredSwap = async (
    page: Page,
    id: string,
): Promise<StoredBridgeSwap | null> =>
    await page.evaluate(
        async ({ id }) =>
            await new Promise<StoredBridgeSwap | null>((resolve, reject) => {
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
                        resolve(getRequest.result ?? null);
                    };
                    getRequest.onerror = () => reject(getRequest.error);
                };
            }),
        { id },
    );

const waitForBridgeTxHash = async (page: Page, id: string): Promise<Hex> => {
    await expect
        .poll(async () => (await getStoredSwap(page, id))?.bridge?.txHash, {
            timeout: actionTimeout,
        })
        .toMatch(/^0x[0-9a-fA-F]{64}$/);

    return (await getStoredSwap(page, id))!.bridge!.txHash!;
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

const selectAssets = async (
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

const createSwap = async (
    page: Page,
    sendAsset: string,
    receiveAsset: string,
    destinationAddress: string,
    sendAmount: string,
    options?: { skipGoto?: boolean; walletAddress?: Address },
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

    await expect(swapReady.or(downloadButton)).toBeVisible({
        timeout: actionTimeout,
    });
    if (await downloadButton.isVisible().catch(() => false)) {
        await verifyRescueFile(page);
    }
    await expect(swapReady).toBeVisible({ timeout: actionTimeout });

    return getCurrentSwapId(page);
};

const getTokenBalance = async (
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

// Funds the test wallet with gas + USDT0-ETH by impersonating a whale on the
// Anvil fork, so the test does not depend on an external funding container.
const fundStablesE2eWallet = async (
    publicClient: PublicClient,
    wallet: Address,
) => {
    const token = getRegtestTokenAddress("USDT0-ETH");
    const tokenCode = await publicClient.getCode({ address: token });
    if (tokenCode === undefined || tokenCode === "0x") {
        throw new Error("Ethereum e2e fork is missing the USDT0-ETH contract");
    }

    if (
        (await getTokenBalance(publicClient, token, wallet)) >=
        parseUnits(usdt0EthSendAmount, 6)
    ) {
        return;
    }

    await publicClient.request({
        method: "anvil_setBalance" as never,
        params: [wallet, "0x" + parseEther("10").toString(16)] as never,
    });
    await publicClient.request({
        method: "anvil_setBalance" as never,
        params: [
            stablesFundingSource,
            "0x" + parseEther("1").toString(16),
        ] as never,
    });
    await publicClient.request({
        method: "anvil_impersonateAccount" as never,
        params: [stablesFundingSource] as never,
    });

    try {
        const walletClient = createWalletClient({
            account: stablesFundingSource,
            chain: ethereumE2eChain,
            transport: http(ethereumRpcUrl(), { timeout: actionTimeout }),
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
            params: [stablesFundingSource] as never,
        });
    }
};

const expectEthereumWalletReady = async (
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

const connectWallet = async (page: Page, walletAddress: Address) => {
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

const clickSendBridge = async (page: Page, walletAddress: Address) => {
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

const expectOftSendTx = async (
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

// Whale holding USD₮0 on the Arbitrum fork; impersonated to fund the test
// wallet so it can send a native USDT0 (Arbitrum) commitment swap.
const usdt0FundingSource = getAddress(
    "0xF977814e90dA44bFA03b6295A0616a897441aceC",
);
const usdt0FundingAmount = parseUnits("500", 6);

type ArbitrumE2e = { chain: Chain; publicClient: PublicClient; rpcUrl: string };

const arbWalletAccountIndex = 3;

const getArbWalletAddress = async (
    publicClient: PublicClient,
): Promise<Address> => {
    const accounts = (await publicClient.request({
        method: "eth_accounts",
        params: [],
    } as never)) as Address[];
    const walletAddress = accounts[arbWalletAccountIndex];
    if (walletAddress === undefined) {
        throw new Error(
            `Arbitrum account #${arbWalletAccountIndex} is not available in Anvil`,
        );
    }
    return getAddress(walletAddress);
};

const clearEoaDelegation = async (
    publicClient: PublicClient,
    account: Address,
) => {
    await publicClient.request({
        method: "anvil_setCode" as never,
        params: [account, "0x"] as never,
    });
};

const fundArbUsdt0Wallet = async (arbitrum: ArbitrumE2e, wallet: Address) => {
    const token = getRegtestTokenAddress("USDT0");
    if (
        (await getTokenBalance(arbitrum.publicClient, token, wallet)) >=
        parseUnits(usdt0EthSendAmount, 6)
    ) {
        return;
    }

    await arbitrum.publicClient.request({
        method: "anvil_setBalance" as never,
        params: [
            usdt0FundingSource,
            `0x${parseEther("1").toString(16)}`,
        ] as never,
    });
    await arbitrum.publicClient.request({
        method: "anvil_impersonateAccount" as never,
        params: [usdt0FundingSource] as never,
    });

    try {
        const walletClient = createWalletClient({
            account: usdt0FundingSource,
            chain: arbitrum.chain,
            transport: http(arbitrum.rpcUrl, { timeout: actionTimeout }),
        });
        const hash = await walletClient.writeContract({
            address: token,
            abi: erc20Abi,
            functionName: "transfer",
            args: [wallet, usdt0FundingAmount],
        });
        await arbitrum.publicClient.waitForTransactionReceipt({ hash });
    } finally {
        await arbitrum.publicClient.request({
            method: "anvil_stopImpersonatingAccount" as never,
            params: [usdt0FundingSource] as never,
        });
    }
};

const lockupCommitment = async (page: Page, walletAddress: Address) => {
    await connectWallet(page, walletAddress);

    const approve = page.getByRole("button", { name: /^approve$/i });
    const send = page.getByRole("button", { name: /^send$/i });

    await expect(send.or(approve)).toBeVisible({ timeout: actionTimeout });
    if (await approve.isVisible().catch(() => false)) {
        await approve.click();
        await expect(approve).toBeHidden({ timeout: actionTimeout });
    }

    await expect(send).toBeEnabled({ timeout: actionTimeout });
    await send.click();
};

describeArbitrumE2e("Arbitrum stablecoin e2e", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("claims an L-BTC to USDT0-Arbitrum chain swap", async ({
        arbitrum,
        recipientAddress,
        page,
    }) => {
        test.setTimeout(testTimeout);

        const token = getRegtestTokenAddress("USDT0");
        const balanceBefore = await getTokenBalance(
            arbitrum.publicClient,
            token,
            recipientAddress,
        );

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("TBTC"),
            tokenOut: getRegtestTokenAddress("USDT0"),
            amountIn: parseUnits(lbtcSendAmount, 18),
            label: "TBTC -> USDT0",
        });
        await createSwap(
            page,
            "L-BTC",
            "USDT0",
            recipientAddress,
            lbtcSendAmount,
        );

        await page
            .locator("div[data-testid='pay-onchain-buttons']")
            .getByText("address")
            .click();

        const lockupAddress = await page.evaluate(() =>
            navigator.clipboard.readText(),
        );
        expect(lockupAddress).toBeDefined();

        await elementsSendToAddress(lockupAddress, lbtcSendAmount);
        await generateLiquidBlock();

        await expect(
            page.locator("div[data-status='transaction.claimed']"),
        ).toBeVisible({ timeout: actionTimeout });

        const balanceAfter = await getTokenBalance(
            arbitrum.publicClient,
            token,
            recipientAddress,
        );
        expect(balanceAfter).toBeGreaterThan(balanceBefore);
    });

    test("sends USDT0-ETH OFT bridge tx for an L-BTC chain swap", async ({
        arbitrum,
        page,
    }) => {
        test.setTimeout(testTimeout);

        // Requesting the arbitrum fixture runs the worker setup (RPC wait and
        // backend TBTC liquidity) needed before the USDT0 -> TBTC DEX hop.
        void arbitrum;

        const ethereum = createEthereumClient();
        await waitForEthereumRpc(ethereum);

        const walletAddress = await getStablesE2eWalletAddress(ethereum);
        const walletClient = createWalletClient({
            account: walletAddress,
            chain: ethereumE2eChain,
            transport: http(ethereumRpcUrl(), { timeout: actionTimeout }),
        });

        await fundStablesE2eWallet(ethereum, walletAddress);
        await expectEthereumWalletReady(ethereum, walletAddress);
        await injectWalletProvider({
            page,
            publicClient: ethereum,
            walletClient,
            chain: ethereumE2eChain,
        });

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("USDT0"),
            tokenOut: getRegtestTokenAddress("TBTC"),
            amountIn: parseUnits("39.996", 6),
            label: "USDT0 -> TBTC",
        });

        const swapId = await createSwap(
            page,
            "USDT0-ETH",
            "L-BTC",
            await getLiquidAddress(),
            usdt0EthSendAmount,
            { walletAddress },
        );
        await clickSendBridge(page, walletAddress);

        await expectOftSendTx(
            ethereum,
            await waitForBridgeTxHash(page, swapId),
            walletAddress,
        );
    });

    test("offers a source-asset refund when the backend rejects the commitment", async ({
        arbitrum,
        page,
    }) => {
        test.setTimeout(testTimeout);

        const walletAddress = await getArbWalletAddress(arbitrum.publicClient);
        await clearEoaDelegation(arbitrum.publicClient, walletAddress);
        await fundArbUsdt0Wallet(arbitrum, walletAddress);
        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient: createWalletClient({
                account: walletAddress,
                chain: arbitrum.chain,
                transport: http(arbitrum.rpcUrl, { timeout: actionTimeout }),
            }),
            chain: arbitrum.chain,
        });

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("USDT0"),
            tokenOut: getRegtestTokenAddress("TBTC"),
            amountIn: parseUnits("39.996", 6),
            label: "USDT0 -> TBTC",
        });

        // Force the backend to permanently reject the commitment post.
        let commitmentPosts = 0;
        await page.route("**/v2/commitment/*", async (route, request) => {
            const isRefund = new URL(request.url()).pathname.endsWith(
                "/refund",
            );
            if (request.method() !== "POST" || isRefund) {
                await route.continue();
                return;
            }

            commitmentPosts += 1;
            await route.fulfill({
                status: 400,
                contentType: "application/json",
                body: JSON.stringify({
                    error: "insufficient amount: 16643 < 16650",
                }),
            });
        });

        await createSwap(
            page,
            "USDT0",
            "L-BTC",
            await getLiquidAddress(),
            usdt0EthSendAmount,
            { walletAddress },
        );
        await lockupCommitment(page, walletAddress);

        await expect(
            page.getByText(dict.en.commitment_rejected_line),
        ).toBeVisible({ timeout: testTimeout });

        await expect(
            page.getByRole("button", {
                name: new RegExp(`^${dict.en.refund}$`, "i"),
            }),
        ).toBeVisible({ timeout: actionTimeout });

        expect(commitmentPosts).toBeGreaterThan(0);
        const postsAtRejection = commitmentPosts;
        await page.waitForTimeout(7_000);
        expect(commitmentPosts).toBe(postsAtRejection);

        const usdt0 = getRegtestTokenAddress("USDT0");
        const usdt0BeforeRefund = await getTokenBalance(
            arbitrum.publicClient,
            usdt0,
            walletAddress,
        );
        await page
            .getByRole("button", {
                name: new RegExp(`^${dict.en.refund}$`, "i"),
            })
            .click();
        await expect
            .poll(
                () =>
                    getTokenBalance(
                        arbitrum.publicClient,
                        usdt0,
                        walletAddress,
                    ),
                {
                    timeout: actionTimeout,
                    message: "cooperative refund returns USDT0 to the wallet",
                },
            )
            .toBeGreaterThan(usdt0BeforeRefund);
    });
});
