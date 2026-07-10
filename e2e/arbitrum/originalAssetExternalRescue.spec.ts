import type { Page } from "@playwright/test";
import { createWalletClient, http, parseUnits } from "viem";

import dict from "../../src/i18n/i18n";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    execCommand,
    generateBitcoinBlock,
    generateLiquidBlock,
    getLiquidAddress,
} from "../utils";
import {
    actionTimeout,
    approveAndSend,
    arbitrumE2eChain,
    arbitrumRpcUrl,
    clearBrowserStorage,
    clearEoaDelegation,
    createSwap,
    describeArbitrumE2e,
    expect,
    fundErc20FromWhale,
    getArbitrumWalletAddress,
    getRegtestTokenAddress,
    getStoredSwap,
    getTokenBalance,
    lbtcSendAmount,
    mineArbitrumBlocks,
    scanAndSelectExternalResult,
    stablesFundingSource,
    test,
    usdt0EthSendAmount,
    waitForDexQuote,
    waitForLockupTxHash,
    waitForMetadataPatch,
    waitForStablePairHash,
} from "./shared";

const originalAssetRescueTimeout = 240_000;
const usdt0FundingAmount = parseUnits("500", 6);
const refundWalletIndex = 8;
const claimWalletIndex = 9;
// Deliberately different from the wallet used for the rescue so the test
// proves funds go to the original destination, not the connected signer.
const claimDestinationIndex = 7;

const blockCommitmentSubmission = async (page: Page) => {
    let commitmentPosts = 0;

    await page.route("**/v2/commitment/*", async (route, request) => {
        const isRefund = new URL(request.url()).pathname.endsWith("/refund");
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

    return () => commitmentPosts;
};

const elementsSendToAddressNoRbf = (address: string, amount: string) =>
    execCommand(
        `elements-cli-sim-client -named sendtoaddress address="${address}" amount=${amount} replaceable=false`,
    );

describeArbitrumE2e("Arbitrum original-asset external rescue e2e", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("refunds a pre-DEX commitment lockup back to USDT0", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(originalAssetRescueTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const walletAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            refundWalletIndex,
        );
        const token = getRegtestTokenAddress("USDT0");

        await fundErc20FromWhale({
            publicClient: arbitrum.publicClient,
            chain: arbitrumE2eChain,
            rpcUrl: arbitrum.rpcUrl,
            token,
            whale: stablesFundingSource,
            recipient: walletAddress,
            amount: usdt0FundingAmount,
        });
        await clearEoaDelegation(arbitrum.publicClient, walletAddress);
        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient: createWalletClient({
                account: walletAddress,
                chain: arbitrumE2eChain,
                transport: http(arbitrumRpcUrl(), { timeout: actionTimeout }),
            }),
            chain: arbitrumE2eChain,
        });
        const commitmentPosts = await blockCommitmentSubmission(page);

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("USDT0"),
            tokenOut: getRegtestTokenAddress("TBTC"),
            amountIn: parseUnits("39.996", 6),
            label: "USDT0 -> TBTC",
        });
        await waitForStablePairHash("chain", "TBTC", "L-BTC");

        const swapId = await createSwap(
            page,
            "USDT0",
            "L-BTC",
            await getLiquidAddress(),
            usdt0EthSendAmount,
            { walletAddress, rescueFilePath },
        );
        const metadataPatch = waitForMetadataPatch(page, swapId);

        await approveAndSend(page, walletAddress);
        await waitForLockupTxHash(page, swapId);
        await metadataPatch;

        await expect(
            page.getByText(dict.en.commitment_rejected_line),
        ).toBeVisible({ timeout: actionTimeout });
        expect(commitmentPosts()).toBeGreaterThan(0);

        const balanceAfterLockup = await getTokenBalance(
            arbitrum.publicClient,
            token,
            walletAddress,
        );

        await clearBrowserStorage(page);

        await scanAndSelectExternalResult({
            page,
            swapId,
            walletAddress,
            rescueFilePath,
            action: dict.en.refund,
            assets: ["USDT", "LBTC"],
        });

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("TBTC"),
            tokenOut: getRegtestTokenAddress("USDT0"),
            amountIn: parseUnits("0.0007", 18),
            label: "TBTC -> USDT0 refund",
        });

        const refundButton = page.getByRole("button", {
            name: dict.en.refund,
            exact: true,
        });
        await expect(refundButton).toBeVisible({ timeout: actionTimeout });
        await refundButton.click();

        await expect(page.getByText(dict.en.refunded)).toBeVisible({
            timeout: actionTimeout,
        });
        await expect
            .poll(
                async () =>
                    await getTokenBalance(
                        arbitrum.publicClient,
                        token,
                        walletAddress,
                    ),
                {
                    timeout: actionTimeout,
                    message: "external rescue refunds the original USDT0 asset",
                },
            )
            .toBeGreaterThan(balanceAfterLockup);
    });

    test("claims a post-DEX lockup to the original USDT0 destination", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(originalAssetRescueTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const walletAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            claimWalletIndex,
        );
        const destinationAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            claimDestinationIndex,
        );
        const token = getRegtestTokenAddress("USDT0");

        await clearEoaDelegation(arbitrum.publicClient, walletAddress);
        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient: createWalletClient({
                account: walletAddress,
                chain: arbitrumE2eChain,
                transport: http(arbitrumRpcUrl(), { timeout: actionTimeout }),
            }),
            chain: arbitrumE2eChain,
        });

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("TBTC"),
            tokenOut: getRegtestTokenAddress("USDT0"),
            amountIn: parseUnits(lbtcSendAmount, 18),
            label: "TBTC -> USDT0",
        });
        await waitForStablePairHash("chain", "L-BTC", "TBTC");

        const destinationBalanceBefore = await getTokenBalance(
            arbitrum.publicClient,
            token,
            destinationAddress,
        );
        const walletBalanceBefore = await getTokenBalance(
            arbitrum.publicClient,
            token,
            walletAddress,
        );

        const swapId = await createSwap(
            page,
            "L-BTC",
            "USDT0",
            destinationAddress,
            lbtcSendAmount,
            { rescueFilePath },
        );

        const storedSwap = await getStoredSwap(page, swapId);
        expect(storedSwap?.originalDestination?.toLowerCase()).toBe(
            destinationAddress.toLowerCase(),
        );

        await page
            .locator("div[data-testid='pay-onchain-buttons']")
            .getByText("address")
            .click();
        const lockupAddress = await page.evaluate(() =>
            navigator.clipboard.readText(),
        );
        expect(lockupAddress).toBeDefined();

        await elementsSendToAddressNoRbf(lockupAddress, lbtcSendAmount);
        await generateLiquidBlock();

        await clearBrowserStorage(page);

        await scanAndSelectExternalResult({
            page,
            swapId,
            walletAddress,
            rescueFilePath,
            action: dict.en.claim,
            assets: ["LBTC", "USDT"],
        });

        const continueButton = page.getByRole("button", {
            name: dict.en.continue,
            exact: true,
        });
        await expect(continueButton).toBeVisible({ timeout: actionTimeout });
        await continueButton.click();

        await expect(page.getByText(dict.en.claimed)).toBeVisible({
            timeout: actionTimeout,
        });
        await mineArbitrumBlocks(arbitrum.publicClient, 1);
        await expect
            .poll(
                async () =>
                    await getTokenBalance(
                        arbitrum.publicClient,
                        token,
                        destinationAddress,
                    ),
                {
                    timeout: actionTimeout,
                    message:
                        "external rescue claims USDT0 to the original destination",
                },
            )
            .toBeGreaterThan(destinationBalanceBefore);

        // The connected rescue wallet must not receive the claimed funds.
        expect(
            await getTokenBalance(arbitrum.publicClient, token, walletAddress),
        ).toBe(walletBalanceBefore);
    });
});
