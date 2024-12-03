import { expect, test } from "@playwright/test";

import { getBitcoinAddress } from "../utils";

test.describe("Chain Swap 0-amount", () => {
    test("should allow 0-amount chain swaps", async ({ page }) => {
        await page.goto("/");

        const assetSelector = page.locator("div[class='asset asset-LN'] div");
        await assetSelector.click();

        await page.locator("div[data-testid='select-L-BTC']").click();

        const inputOnchainAddress = page.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(await getBitcoinAddress());

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        const skipDownload = page.getByText("Skip download");
        await skipDownload.click();
    });

    test("should not allow 0-amount chain swaps when sending RBTC", async ({
        page,
    }) => {
        await page.goto("/");

        const assetSelector = page.locator("div[class='asset asset-LN'] div");
        await assetSelector.click();

        await page.locator("div[data-testid='select-RBTC']").click();

        const inputOnchainAddress = page.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(await getBitcoinAddress());

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        const createButton = await buttonCreateSwap.elementHandle();
        await expect(createButton.getAttribute("disabled")).resolves.toEqual(
            "",
        );
    });
});
