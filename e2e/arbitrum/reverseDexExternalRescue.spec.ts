import type { Page } from "@playwright/test";
import fs from "node:fs";
import { type PublicClient, createWalletClient, http, parseUnits } from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { injectWalletProvider } from "../fixtures/ethereum";
import { generateBitcoinBlock, payInvoiceLndBackground } from "../utils";
import {
    actionTimeout,
    arbitrumE2eChain,
    arbitrumRpcUrl,
    clearBrowserStorage,
    clearEoaDelegation,
    createSwap,
    describeArbitrumE2e,
    expect,
    getArbitrumWalletAddress,
    getRegtestTokenAddress,
    getStoredSwap,
    getTokenBalance,
    mineArbitrumBlocks,
    scanAndSelectExternalResult,
    test,
    waitForDexQuote,
    waitForStablePairHash,
} from "./shared";

const reverseDexRescueTimeout = 240_000;
const lnSendAmount = "0.001";
const rescueWalletIndex = 6;
// Deliberately different from the wallet used for the rescue so the test
// proves funds go to the original destination, not the connected signer.
const destinationIndex = 5;

const getLightningInvoice = async (page: Page) => {
    const href = await page
        .locator("a[href^='lightning:']")
        .first()
        .getAttribute("href", { timeout: actionTimeout });
    const invoice = href?.replace(/^lightning:/, "") ?? "";
    expect(invoice.toLowerCase()).toMatch(/^lnbcrt/);
    return invoice;
};

const waitForSwapLockupConfirmed = async (
    publicClient: PublicClient,
    swapId: string,
) => {
    await expect
        .poll(
            async () => {
                await mineArbitrumBlocks(publicClient, 1);
                const response = await fetch(
                    `${config.apiUrl.normal}/v2/swap/${swapId}`,
                    { signal: AbortSignal.timeout(10_000) },
                );
                if (!response.ok) {
                    return "";
                }

                const swap = (await response.json()) as { status?: unknown };
                return typeof swap.status === "string" ? swap.status : "";
            },
            {
                timeout: actionTimeout * 2,
                intervals: [2_000, 3_000, 5_000],
                message: "Boltz confirms the reverse swap TBTC lockup",
            },
        )
        .toBe("transaction.confirmed");
};

describeArbitrumE2e("Arbitrum reverse DEX swap external rescue e2e", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
        await generateBitcoinBlock();
    });

    test("claims a reverse DEX swap to the original USDT0 destination", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(reverseDexRescueTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const walletAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            rescueWalletIndex,
        );
        const destinationAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            destinationIndex,
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
            amountIn: parseUnits(lnSendAmount, 18),
            label: "TBTC -> USDT0",
        });
        await waitForStablePairHash("reverse", "BTC", "TBTC");

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
            "LN",
            "USDT0",
            destinationAddress,
            lnSendAmount,
            { rescueFilePath },
        );

        const storedSwap = await getStoredSwap(page, swapId);
        expect(storedSwap?.originalDestination?.toLowerCase()).toBe(
            destinationAddress.toLowerCase(),
        );

        if (!fs.existsSync(rescueFilePath)) {
            const storedRescueFile = await page.evaluate(() =>
                window.localStorage.getItem("rescueFile"),
            );
            expect(storedRescueFile).toBeTruthy();
            fs.writeFileSync(rescueFilePath, storedRescueFile!);
        }

        const invoice = await getLightningInvoice(page);

        await clearBrowserStorage(page);
        await page.goto("about:blank");

        payInvoiceLndBackground(invoice);
        await waitForSwapLockupConfirmed(arbitrum.publicClient, swapId);

        await scanAndSelectExternalResult({
            page,
            swapId,
            walletAddress,
            rescueFilePath,
            action: dict.en.claim,
            assets: ["LN", "USDT"],
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

        expect(
            await getTokenBalance(arbitrum.publicClient, token, walletAddress),
        ).toBe(walletBalanceBefore);
    });
});
