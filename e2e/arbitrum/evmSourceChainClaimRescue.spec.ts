import type { Page } from "@playwright/test";
import { SwapType } from "boltz-swaps/types";
import { createWalletClient, http, parseUnits } from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { getRestorableSwaps } from "../boltzClient";
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
    clearBrowserStorage,
    clearEoaDelegation,
    createSwap,
    describeArbitrumE2e,
    expect,
    expectArbitrumWalletReady,
    fullFlowTestTimeout,
    fundArbitrumStablesE2eWallet,
    getArbitrumWalletAddress,
    getRegtestTokenAddress,
    scanAndSelectExternalResult,
    test,
    usdt0EthSendAmount,
    waitForDexQuote,
    waitForLockupTxHash,
    waitForMetadataPatch,
    waitForStablePairHash,
} from "./shared";

const walletIndex = 2;

// Keep the original page from revealing the preimage before the browser state
// is cleared. ClaimRescue must be the code path that broadcasts the L-BTC claim.
const blockAutomaticLiquidClaim = async (page: Page) => {
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

const waitForClaimableRestore = async (
    rescueFilePath: string,
    swapId: string,
) => {
    let restoredStatus = "";

    await expect
        .poll(
            async () => {
                try {
                    const restored = (
                        await getRestorableSwaps(rescueFilePath)
                    ).find((swap) => swap.id === swapId);
                    restoredStatus = restored?.status ?? "";
                    return restoredStatus;
                } catch {
                    return "";
                }
            },
            {
                timeout: actionTimeout,
                message:
                    "the restored EVM-source chain swap has an L-BTC server lockup",
            },
        )
        .toMatch(/^transaction\.server\.(?:mempool|confirmed)$/);

    if (restoredStatus === "transaction.server.mempool") {
        await generateLiquidBlock();
        await expect
            .poll(
                async () => {
                    const restored = (
                        await getRestorableSwaps(rescueFilePath)
                    ).find((swap) => swap.id === swapId);
                    return restored?.status ?? "";
                },
                {
                    timeout: actionTimeout,
                    message:
                        "the restored EVM-source chain swap server lockup confirms",
                },
            )
            .toBe("transaction.server.confirmed");
    }

    const restored = (await getRestorableSwaps(rescueFilePath)).find(
        (swap) => swap.id === swapId,
    );
    expect(restored).toMatchObject({
        id: swapId,
        type: SwapType.Chain,
        from: "TBTC",
        to: "L-BTC",
    });
    expect(restored?.claimDetails).toBeDefined();
    expect(restored?.refundDetails).toBeUndefined();
};

describeArbitrumE2e("Arbitrum EVM-source chain claim rescue e2e", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("restores and claims the L-BTC leg instead of showing the linked EVM refund", async ({
        arbitrum,
        context,
        page,
    }, testInfo) => {
        test.setTimeout(fullFlowTestTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const walletAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            walletIndex,
        );

        await fundArbitrumStablesE2eWallet(
            arbitrum.publicClient,
            walletAddress,
        );
        await expectArbitrumWalletReady(arbitrum.publicClient, walletAddress);
        await clearEoaDelegation(arbitrum.publicClient, walletAddress);
        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient: createWalletClient({
                account: walletAddress,
                chain: arbitrumE2eChain,
                transport: http(arbitrumRpcUrl(), {
                    timeout: actionTimeout,
                }),
            }),
            chain: arbitrumE2eChain,
        });
        await blockAutomaticLiquidClaim(page);

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

        await clearBrowserStorage(page);
        await page.goto("about:blank");
        await waitForClaimableRestore(rescueFilePath, swapId);

        // Routes are page-scoped, so this fresh page can broadcast the rescue
        // claim while the original page remains unable to auto-claim.
        const rescuePage = await context.newPage();
        try {
            await scanAndSelectExternalResult({
                page: rescuePage,
                swapId,
                rescueFilePath,
                action: dict.en.claim,
                assets: ["USDT", "LBTC"],
            });

            const claimAddress = await getLiquidAddress();
            await rescuePage.getByTestId("onchainAddress").fill(claimAddress);

            const claimButton = rescuePage.getByRole("button", {
                name: dict.en.claim,
                exact: true,
            });
            await expect(claimButton).toBeEnabled({
                timeout: actionTimeout,
            });
            await claimButton.click();

            await expect(rescuePage.getByTestId("claimed")).toBeVisible({
                timeout: actionTimeout,
            });
            await expect(
                rescuePage.getByRole("link", {
                    name: "Open Claim Transaction",
                }),
            ).toBeVisible();
        } finally {
            await rescuePage.close();
        }
    });
});
