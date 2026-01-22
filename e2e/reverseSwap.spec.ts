import { expect, test } from "@playwright/test";

import {
    generateBitcoinBlock,
    getBitcoinAddress,
    getBitcoinWalletTx,
    payInvoiceLnd,
    payInvoiceLndBackground,
} from "./utils";

test.describe("reverseSwap", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
    });

    test("Reverse swap BTC/BTC", async ({ page }) => {
        await page.goto("/");

        const receiveAmount = "0.01";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        await expect(inputSendAmount).toHaveValue("0.01005284");

        const inputOnchainAddress = page.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(await getBitcoinAddress());

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        const payInvoiceTitle = page.locator(
            "h2[data-testid='pay-invoice-title']",
        );
        await expect(payInvoiceTitle).toHaveText(
            "Pay this invoice about 0.01005284 BTC",
        );

        const spanLightningInvoice = page.locator("span[class='btn']");
        await spanLightningInvoice.click();

        const lightningInvoice = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(lightningInvoice).toBeDefined();

        await payInvoiceLnd(lightningInvoice);

        const txIdLink = page.getByText("open claim transaction");

        const txId = (await txIdLink.getAttribute("href")).split("/").pop();
        expect(txId).toBeDefined();

        const txInfo = JSON.parse(await getBitcoinWalletTx(txId));
        expect(txInfo.amount.toString()).toEqual(receiveAmount);
    });

    test("LN/BTC with zeroConf toggle automatically claims swap", async ({
        page,
    }) => {
        await page.goto("/");

        // Turn off zeroConf
        const settingsCog = page.locator("[data-testid='settings-cog']");
        await settingsCog.click();
        await page.locator("#settings-menu").waitFor({ state: "visible" });
        await page.locator("[data-testid='zero-conf-toggle']").click();
        await page.locator("#settings-menu .close").click();

        // Create reverse swap BTC->LN
        const receiveAmount = "0.01";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        const sendAmount = "0.01005284";
        await expect(inputSendAmount).toHaveValue(sendAmount);

        const inputOnchainAddress = page.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(await getBitcoinAddress());

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        // Wait for invoice to appear
        const payInvoiceTitle = page.locator(
            "h2[data-testid='pay-invoice-title']",
        );
        await expect(payInvoiceTitle).toHaveText(
            "Pay this invoice about 0.01005284 BTC",
        );

        // Pay the Lightning invoice
        const spanLightningInvoice = page.locator("span[class='btn']");
        await spanLightningInvoice.click();

        const lightningInvoice = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });

        payInvoiceLndBackground(lightningInvoice);

        await expect(
            page.locator("div[data-status='transaction.mempool']"),
        ).toBeVisible({ timeout: 15_000 });

        // Turn on zeroConf
        await settingsCog.click();

        await page.locator("#settings-menu").waitFor({ state: "visible" });

        const toggleAfter = page.locator("[data-testid='zero-conf-toggle']");

        await toggleAfter.click();

        await page.locator("#settings-menu .close").click();

        // Verify swap is automatically claimed
        await expect(
            page.locator("div[data-status='invoice.settled']"),
        ).toBeVisible({ timeout: 15_000 });
    });
});
