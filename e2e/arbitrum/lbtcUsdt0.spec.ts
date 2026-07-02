import type { Page } from "@playwright/test";
import {
    type Address,
    type PublicClient,
    createWalletClient,
    getAddress,
    http,
    parseUnits,
} from "viem";

import dict from "../../src/i18n/i18n";
import { expect, test } from "../fixtures/arbitrum";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
    getLiquidAddress,
} from "../utils";
import {
    actionTimeout,
    clickSendBridge,
    connectWallet,
    createEthereumClient,
    createSwap,
    describeArbitrumE2e,
    ethereumE2eChain,
    ethereumRpcUrl,
    expectEthereumWalletReady,
    expectOftSendTx,
    fullFlowTestTimeout,
    fundArbitrumStablesE2eWallet,
    fundEthereumStablesE2eWallet,
    getRegtestTokenAddress,
    getStablesE2eWalletAddress,
    getTokenBalance,
    testTimeout,
    usdt0EthSendAmount,
    waitForBridgeTxHash,
    waitForDexQuote,
    waitForEthereumRpc,
} from "./utils";

const lbtcSendAmount = "0.001";

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
        test.setTimeout(fullFlowTestTimeout);

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
        ).toBeVisible({ timeout: fullFlowTestTimeout });

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

        expect(await arbitrum.publicClient.getChainId()).toBe(
            arbitrum.chain.id,
        );

        const ethereum = createEthereumClient();
        await waitForEthereumRpc(ethereum);

        const walletAddress = await getStablesE2eWalletAddress(ethereum);
        const walletClient = createWalletClient({
            account: walletAddress,
            chain: ethereumE2eChain,
            transport: http(ethereumRpcUrl(), { timeout: actionTimeout }),
        });

        await fundEthereumStablesE2eWallet(ethereum, walletAddress);
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
