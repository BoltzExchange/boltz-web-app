import { expect, test } from "@playwright/test";

import {
    generateBitcoinBlock,
    getBitcoinAddress,
    getBitcoinWalletTx,
    payInvoiceLnd,
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
        await expect(inputSendAmount).toHaveValue("0.01005558");

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
            "Pay this invoice about 0.01005558 BTC",
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
});
