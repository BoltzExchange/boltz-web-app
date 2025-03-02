import { expect, test } from "@playwright/test";

import {
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
    getBitcoinWalletTx,
    verifyRescueFile,
} from "../utils";

test.describe("Chain swap", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
    });

    test("BTC/L-BTC", async ({ page }) => {
        await page.goto("/");

        const assetSelector = page.locator("div[class='asset asset-LN'] div");
        await assetSelector.click();

        const lbtcAsset = page.locator("div[data-testid='select-L-BTC']");
        await lbtcAsset.click();

        const receiveAmount = "0.01";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        const sendAmount = "0.01003057";
        await expect(inputSendAmount).toHaveValue(sendAmount);

        const inputOnchainAddress = page.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(await getBitcoinAddress());

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        await verifyRescueFile(page);

        const buttons = page.locator("div[data-testid='pay-onchain-buttons']");
        const copyAddressButton = buttons.getByText("address");
        expect(copyAddressButton).toBeDefined();
        await copyAddressButton.click();

        const sendAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(sendAddress).toBeDefined();

        await elementsSendToAddress(sendAddress, sendAmount);
        await generateLiquidBlock();

        const txIdLink = page.getByText("open claim transaction");

        const txId = (await txIdLink.getAttribute("href")).split("/").pop();
        expect(txId).toBeDefined();

        const txInfo = JSON.parse(await getBitcoinWalletTx(txId));
        expect(txInfo.amount.toString()).toEqual(receiveAmount);
    });
});
