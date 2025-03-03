import { expect, test } from "@playwright/test";

import dict from "../src/i18n/i18n";
import { generateBitcoinBlock, getBolt12Offer } from "./utils";

test.describe("BOLT12", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
    });

    test("Resolve bolt12 offer", async ({ page }) => {
        await page.goto("/");

        const divFlipAssets = page.locator("#flip-assets");
        await divFlipAssets.click();

        const receiveAmount = "0.01";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const invoiceInput = page.locator("textarea[data-testid='invoice']");
        await invoiceInput.fill(await getBolt12Offer());
        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        const downloadButton = page.getByText(dict.en.download_new_key);
        await expect(downloadButton).toBeVisible();
    });
});
