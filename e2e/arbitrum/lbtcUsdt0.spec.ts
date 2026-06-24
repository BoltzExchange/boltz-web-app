import type { Page } from "@playwright/test";
import {
    type Address,
    type PublicClient,
    getAddress,
    parseAbi,
    parseUnits,
} from "viem";

import { config } from "../../src/config";
import { expect, shouldRunArbitrumE2e, test } from "../fixtures/arbitrum";
import {
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
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
]);

const lbtcSendAmount = "0.001";
const quoteRequestTimeout = 60_000;
const quoteReadinessTimeout = 90_000;
const swapClaimTimeout = 75_000;
const swapClaimTestTimeout = 150_000;

const getRegtestTokenAddress = (asset: "USDT0" | "TBTC"): Address => {
    const address = config.assets?.[asset]?.token?.address;
    if (address === undefined) {
        throw new Error(`missing ${asset} token address`);
    }

    return getAddress(address);
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
    const deadline = Date.now() + quoteReadinessTimeout;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(quoteRequestTimeout),
            });
            if (response.ok) {
                const quotes = await response.json();
                if (Array.isArray(quotes) && quotes.length > 0) {
                    return;
                }
            }
            lastError = `${response.status} ${response.statusText}`;
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    throw new Error(`quote not ready for ${args.label}: ${String(lastError)}`);
};

const chooseAsset = async (page: Page, asset: string) => {
    await page.getByTestId(`select-${asset}`).click();
    await expect(page.locator(".asset-select-overlay")).toBeHidden({
        timeout: 5_000,
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
    options?: { skipGoto?: boolean },
) => {
    if (options?.skipGoto !== true) {
        await page.goto("/");
    }
    await selectAssets(page, sendAsset, receiveAsset);
    await page.getByTestId("onchainAddress").fill(destinationAddress);
    await page.getByTestId("sendAmount").fill(sendAmount);

    const receiveAmount = page.getByTestId("receiveAmount");
    await expect(receiveAmount).not.toHaveValue("", { timeout: 60_000 });
    await expect(receiveAmount).not.toHaveValue("0", { timeout: 60_000 });

    const createButton = page.getByTestId("create-swap-button");
    await expect(createButton).toBeEnabled({ timeout: 60_000 });
    await createButton.click();

    await verifyRescueFile(page);
    await expect(page.locator("div[data-status='swap.created']")).toBeVisible({
        timeout: 60_000,
    });
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
        test.setTimeout(swapClaimTestTimeout);

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
        ).toBeVisible({ timeout: swapClaimTimeout });

        const balanceAfter = await getTokenBalance(
            arbitrum.publicClient,
            token,
            recipientAddress,
        );
        expect(balanceAfter).toBeGreaterThan(balanceBefore);
    });
});
