import type { Page } from "@playwright/test";
import { oftAbi } from "boltz-swaps/oft";
import {
    type Address,
    type Chain,
    type Hex,
    type PublicClient,
    createWalletClient,
    getAddress,
    http,
    isAddressEqual,
    parseEther,
    parseEventLogs,
    parseUnits,
} from "viem";

import dict from "../../src/i18n/i18n";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
    getLiquidAddress,
} from "../utils";
import {
    actionTimeout,
    approveAndSend,
    connectWallet,
    createEthereumClient,
    createSwap,
    describeArbitrumE2e,
    erc20Abi,
    ethereumE2eChain,
    ethereumRpcUrl,
    expect,
    getRegtestTokenAddress,
    getStablesE2eWalletAddress,
    getStoredSwap,
    getTokenBalance,
    lbtcSendAmount,
    stablesFundingAmount,
    stablesFundingSource,
    test,
    testTimeout,
    usdt0EthSendAmount,
    waitForBridgeTxHash,
    waitForDexQuote,
    waitForEthereumRpc,
    waitForLockupTxHash,
} from "./shared";

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
        await approveAndSend(page, walletAddress);

        await expectOftSendTx(
            ethereum,
            await waitForBridgeTxHash(page, swapId),
            walletAddress,
        );
    });

    test("claims a USDT0-Arbitrum to L-BTC chain swap", async ({
        arbitrum,
        page,
    }) => {
        test.setTimeout(fullFlowTestTimeout);

        const walletAddress = await getArbWalletAddress(arbitrum.publicClient);
        await clearEoaDelegation(arbitrum.publicClient, walletAddress);
        await fundArbitrumStablesE2eWallet(
            arbitrum.publicClient,
            walletAddress,
        );
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

        const swapId = await createSwap(
            page,
            "USDT0",
            "L-BTC",
            await getLiquidAddress(),
            usdt0EthSendAmount,
            { walletAddress },
        );
        await expect
            .poll(
                async () => (await getStoredSwap(page, swapId))?.dex?.position,
                { timeout: actionTimeout },
            )
            .toBe("pre");

        await lockupCommitment(page, walletAddress);
        await waitForLockupTxHash(page, swapId);

        await expect(
            page.locator("div[data-status='transaction.claimed']"),
        ).toBeVisible({ timeout: fullFlowTestTimeout });
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
