import { expect, test } from "@playwright/test";

import {
    bitcoinSendToAddress,
    generateBitcoinBlock,
    getBitcoinAddress,
    getElementsWalletTx,
    getLiquidAddress,
    verifyRescueFile,
} from "../utils";

test.describe("Chain Swap 0-amount", () => {
    test("BTC/L-BTC", async ({ page }) => {
        await page.goto("/");

        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
            )
            .click();
        await page.getByTestId("select-L-BTC").click();

        await page.locator(".arrow-down").first().click();
        await page.getByTestId("select-BTC").click();

        await page.getByTestId("onchainAddress").click();

        const liquidAddress = await getLiquidAddress();
        await page.getByTestId("onchainAddress").fill(liquidAddress);
        await page.getByTestId("create-swap-button").click();

        await verifyRescueFile(page);

        const buttons = page.locator("div[data-testid='pay-onchain-buttons']");
        const copyAddressButton = buttons.getByText("address");
        expect(copyAddressButton).toBeDefined();
        await copyAddressButton.click();

        const sendAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(sendAddress).toBeDefined();

        await bitcoinSendToAddress(sendAddress, "0.01");

        await page.getByRole("button", { name: "Accept" }).click();
        await generateBitcoinBlock();

        const txIdLink = page.getByText("open claim transaction");

        const txId = (await txIdLink.getAttribute("href")).split("/").pop();
        expect(txId).toBeDefined();

        const txInfo = JSON.parse(await getElementsWalletTx(txId));
        expect(txInfo.amount.bitcoin.toString()).toEqual("0.00997303");
    });

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

        await verifyRescueFile(page);
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
