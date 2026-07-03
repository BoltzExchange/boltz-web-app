import type { Page } from "@playwright/test";
import {
    type Address,
    createWalletClient,
    getAddress,
    http,
    parseUnits,
} from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    generateBitcoinBlock,
    generateLiquidBlock,
    getLiquidAddress,
} from "../utils";
import {
    actionTimeout,
    approveAndSend,
    arbitrumE2eChain,
    arbitrumRpcUrl,
    clearEoaDelegation,
    connectWallet,
    createSwap,
    describeArbitrumE2e,
    expect,
    fundErc20FromWhale,
    getRegtestTokenAddress,
    getStablesE2eWalletAddress,
    getTokenBalance,
    mineArbitrumBlocks,
    quoteRequestTimeout,
    test,
    testTimeout,
    waitForLockupTxHash,
} from "./shared";

const tbtcFundingSource = getAddress(
    process.env.TBTC_E2E_ARB_FUNDING_SOURCE ??
        "0xCb198a55e2a88841E855bE4EAcaad99422416b33",
);
const tbtcSendAmount = "0.001";
const tbtcFundingAmount = parseUnits("0.01", 18);
// Past the TBTC chain timeout delta of 7200 blocks (1440 minutes at 12s blocks)
const timeoutBlocks = 7250;

const clearBrowserStorage = async (page: Page) => {
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

    await page.reload();
};

// Block every claim path that reveals the preimage (cooperative, API broadcast,
// and the explorer-broadcast fallback) so the TBTC lockup stays refundable.
const blockChainSwapClaim = async (page: Page) => {
    await page.route("**/v2/swap/chain/*/claim", (route) => route.abort());
    await page.route("**/v2/chain/L-BTC/transaction", (route) => route.abort());

    for (const explorer of config.assets?.["L-BTC"]?.blockExplorerApis ?? []) {
        for (const base of [explorer.normal, explorer.tor]) {
            if (base !== undefined) {
                await page.route(`${base}/tx`, (route) => route.abort());
            }
        }
    }
};

const startExternalRescue = async (page: Page) => {
    await page.goto("/rescue");
    await page
        .getByRole("button", { name: dict.en.rescue_external_swap })
        .click();
};

// Retry the upload + scan until the swap shows refundable; the scan never refetches on its own.
const rescueAndSelectRefundableSwap = async (
    page: Page,
    walletAddress: Address,
    rescueFilePath: string,
) => {
    const refundableSwap = page
        .locator(".rescue-external-results .swaplist-item")
        .filter({
            has: page.getByRole("link", {
                name: dict.en.refund,
                exact: true,
            }),
        })
        .first();

    await expect(async () => {
        await startExternalRescue(page);
        await page.getByTestId("refundUpload").setInputFiles(rescueFilePath);
        await connectWallet(page, walletAddress);
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
        await expect(refundableSwap).toBeVisible({
            timeout: quoteRequestTimeout,
        });
    }).toPass({ timeout: actionTimeout, intervals: [2_000, 5_000, 10_000] });

    await refundableSwap.click();
};

describeArbitrumE2e("Arbitrum ERC20 refund e2e", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("refunds an expired TBTC chain swap via external rescue", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(testTimeout);
        const rescueFilePath = testInfo.outputPath("rescue-file.json");

        const walletAddress = await getStablesE2eWalletAddress(
            arbitrum.publicClient,
        );
        const walletClient = createWalletClient({
            account: walletAddress,
            chain: arbitrumE2eChain,
            transport: http(arbitrumRpcUrl(), { timeout: actionTimeout }),
        });
        const token = getRegtestTokenAddress("TBTC");

        await fundErc20FromWhale({
            publicClient: arbitrum.publicClient,
            chain: arbitrumE2eChain,
            rpcUrl: arbitrum.rpcUrl,
            token,
            whale: tbtcFundingSource,
            recipient: walletAddress,
            amount: tbtcFundingAmount,
        });
        await clearEoaDelegation(arbitrum.publicClient, walletAddress);

        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient,
            chain: arbitrumE2eChain,
        });

        await blockChainSwapClaim(page);

        const swapId = await createSwap(
            page,
            "TBTC",
            "L-BTC",
            await getLiquidAddress(),
            tbtcSendAmount,
            { walletAddress, rescueFilePath },
        );

        await approveAndSend(page, walletAddress);
        await waitForLockupTxHash(page, swapId);
        const balanceAfterLockup = await getTokenBalance(
            arbitrum.publicClient,
            token,
            walletAddress,
        );

        await clearBrowserStorage(page);
        await mineArbitrumBlocks(arbitrum.publicClient, timeoutBlocks);

        await rescueAndSelectRefundableSwap(
            page,
            walletAddress,
            rescueFilePath,
        );

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
                { timeout: actionTimeout },
            )
            .toBeGreaterThan(balanceAfterLockup);
    });
});
