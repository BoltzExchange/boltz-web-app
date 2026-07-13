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
    type Address,
    type PublicClient,
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
const walletlessRefundWalletIndex = 6;
const walletlessClaimDestinationIndex = 5;
const precedenceFunderIndex = 4;
const precedenceConnectedIndex = 3;

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

const expectNoConnectWalletButton = async (page: Page) => {
    await expect(
        page.getByRole("button", {
            name: new RegExp(dict.en.connect_wallet, "i"),
        }),
    ).toHaveCount(0);
};

type ArbitrumE2e = {
    publicClient: PublicClient;
    rpcUrl: string;
};

const lockPreDexUsdt0Commitment = async ({
    arbitrum,
    page,
    rescueFilePath,
    walletIndex,
}: {
    arbitrum: ArbitrumE2e;
    page: Page;
    rescueFilePath: string;
    walletIndex: number;
}) => {
    const walletAddress = await getArbitrumWalletAddress(
        arbitrum.publicClient,
        walletIndex,
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

    await expect(page.getByText(dict.en.commitment_rejected_line)).toBeVisible({
        timeout: actionTimeout,
    });
    expect(commitmentPosts()).toBeGreaterThan(0);

    const balanceAfterLockup = await getTokenBalance(
        arbitrum.publicClient,
        token,
        walletAddress,
    );

    await clearBrowserStorage(page);

    return { balanceAfterLockup, swapId, token, walletAddress };
};

const refundToOriginalUsdt0 = async ({
    arbitrum,
    page,
    token,
    walletAddress,
    balanceAfterLockup,
    walletless = false,
}: {
    arbitrum: ArbitrumE2e;
    page: Page;
    token: Address;
    walletAddress: Address;
    balanceAfterLockup: bigint;
    walletless?: boolean;
}) => {
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
    await expect(refundButton).toBeEnabled({ timeout: actionTimeout });
    if (walletless) {
        await expectNoConnectWalletButton(page);
    }
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
};

const lockPostDexUsdt0Swap = async ({
    page,
    destinationAddress,
    rescueFilePath,
}: {
    page: Page;
    destinationAddress: Address;
    rescueFilePath: string;
}) => {
    await waitForDexQuote({
        tokenIn: getRegtestTokenAddress("TBTC"),
        tokenOut: getRegtestTokenAddress("USDT0"),
        amountIn: parseUnits(lbtcSendAmount, 18),
        label: "TBTC -> USDT0",
    });
    await waitForStablePairHash("chain", "L-BTC", "TBTC");

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

    return swapId;
};

const claimToOriginalDestination = async ({
    arbitrum,
    page,
    token,
    destinationAddress,
    destinationBalanceBefore,
}: {
    arbitrum: ArbitrumE2e;
    page: Page;
    token: Address;
    destinationAddress: Address;
    destinationBalanceBefore: bigint;
}) => {
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
};

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
        const { balanceAfterLockup, swapId, token, walletAddress } =
            await lockPreDexUsdt0Commitment({
                arbitrum,
                page,
                rescueFilePath,
                walletIndex: refundWalletIndex,
            });

        await scanAndSelectExternalResult({
            page,
            swapId,
            walletAddress,
            rescueFilePath,
            action: dict.en.refund,
            assets: ["USDT", "LBTC"],
        });

        await refundToOriginalUsdt0({
            arbitrum,
            page,
            token,
            walletAddress,
            balanceAfterLockup,
        });
    });

    test("refunds a pre-DEX commitment lockup without a connected wallet", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(originalAssetRescueTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const { balanceAfterLockup, swapId, token, walletAddress } =
            await lockPreDexUsdt0Commitment({
                arbitrum,
                page,
                rescueFilePath,
                walletIndex: walletlessRefundWalletIndex,
            });

        await scanAndSelectExternalResult({
            page,
            swapId,
            rescueFilePath,
            action: dict.en.refund,
            assets: ["USDT", "LBTC"],
        });

        // The destination can only come from the lockup receipt
        await refundToOriginalUsdt0({
            arbitrum,
            page,
            token,
            walletAddress,
            balanceAfterLockup,
            walletless: true,
        });
    });

    test("refunds a pre-DEX lockup to the connected wallet over the original funder", async ({
        arbitrum,
        context,
        page,
    }, testInfo) => {
        test.setTimeout(originalAssetRescueTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const { balanceAfterLockup, swapId, token, walletAddress } =
            await lockPreDexUsdt0Commitment({
                arbitrum,
                page,
                rescueFilePath,
                walletIndex: precedenceFunderIndex,
            });

        // The injected provider is bound to one account per page, so the
        // rescue with a different wallet runs on a fresh page
        const connectedAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            precedenceConnectedIndex,
        );
        const rescuePage = await context.newPage();
        await injectWalletProvider({
            page: rescuePage,
            publicClient: arbitrum.publicClient,
            walletClient: createWalletClient({
                account: connectedAddress,
                chain: arbitrumE2eChain,
                transport: http(arbitrumRpcUrl(), { timeout: actionTimeout }),
            }),
            chain: arbitrumE2eChain,
        });

        const connectedBalanceBefore = await getTokenBalance(
            arbitrum.publicClient,
            token,
            connectedAddress,
        );

        await scanAndSelectExternalResult({
            page: rescuePage,
            swapId,
            walletAddress: connectedAddress,
            rescueFilePath,
            action: dict.en.refund,
            assets: ["USDT", "LBTC"],
        });

        await refundToOriginalUsdt0({
            arbitrum,
            page: rescuePage,
            token,
            walletAddress: connectedAddress,
            balanceAfterLockup: connectedBalanceBefore,
        });

        // The original funder must not receive the refund
        expect(
            await getTokenBalance(arbitrum.publicClient, token, walletAddress),
        ).toBe(balanceAfterLockup);

        await rescuePage.close();
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

        const swapId = await lockPostDexUsdt0Swap({
            page,
            destinationAddress,
            rescueFilePath,
        });

        await scanAndSelectExternalResult({
            page,
            swapId,
            walletAddress,
            rescueFilePath,
            action: dict.en.claim,
            assets: ["LBTC", "USDT"],
        });

        await claimToOriginalDestination({
            arbitrum,
            page,
            token,
            destinationAddress,
            destinationBalanceBefore,
        });

        // The connected rescue wallet must not receive the claimed funds.
        expect(
            await getTokenBalance(arbitrum.publicClient, token, walletAddress),
        ).toBe(walletBalanceBefore);
    });

    test("claims a post-DEX lockup to the original destination without a wallet", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(originalAssetRescueTimeout);

        // No wallet provider is injected at all
        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const destinationAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            walletlessClaimDestinationIndex,
        );
        const token = getRegtestTokenAddress("USDT0");

        const destinationBalanceBefore = await getTokenBalance(
            arbitrum.publicClient,
            token,
            destinationAddress,
        );

        const swapId = await lockPostDexUsdt0Swap({
            page,
            destinationAddress,
            rescueFilePath,
        });

        await scanAndSelectExternalResult({
            page,
            swapId,
            rescueFilePath,
            action: dict.en.claim,
            assets: ["LBTC", "USDT"],
        });

        const continueButton = page.getByRole("button", {
            name: dict.en.continue,
            exact: true,
        });
        await expect(continueButton).toBeVisible({ timeout: actionTimeout });
        await expectNoConnectWalletButton(page);

        await claimToOriginalDestination({
            arbitrum,
            page,
            token,
            destinationAddress,
            destinationBalanceBefore,
        });
    });
});
