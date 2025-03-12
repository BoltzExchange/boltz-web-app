import { expect, test } from "@playwright/test";

import {
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
    getLiquidAddress,
    verifyRescueFile,
} from "../utils";

test.describe("ChainSwap overpayment", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
    });

    test("accept new quote", async ({ page }) => {
        await page.goto("/");

        await page.locator(".arrow-down").first().click();
        await page.getByTestId("select-L-BTC").click();
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
            )
            .click();
        await page.getByTestId("select-BTC").click();
        await page
            .getByTestId("onchainAddress")
            .fill(await getBitcoinAddress());

        await page.getByTestId("receiveAmount").fill("100 000");
        await page.getByTestId("create-swap-button").click();
        await verifyRescueFile(page);
        await page
            .getByTestId("pay-onchain-buttons")
            .getByText("address")
            .click();
        const lockupAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        await elementsSendToAddress(lockupAddress, 0.01);

        await page.getByRole("button", { name: "Accept" }).click();
        await generateLiquidBlock();
        expect(
            page.getByRole("heading", { name: "Congratulations!" }),
        ).toBeDefined();
    });

    test("should refund", async ({ page }) => {
        await page.goto("/");

        await page.locator(".arrow-down").first().click();
        await page.getByTestId("select-L-BTC").click();
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
            )
            .click();
        await page.getByTestId("select-BTC").click();
        await page
            .getByTestId("onchainAddress")
            .fill(await getBitcoinAddress());

        await page.getByTestId("receiveAmount").fill("100 000");
        await page.getByTestId("create-swap-button").click();
        await verifyRescueFile(page);
        await page
            .getByTestId("pay-onchain-buttons")
            .getByText("address")
            .click();
        const lockupAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        await elementsSendToAddress(lockupAddress, 0.01);

        await page.getByRole("button", { name: "Refund" }).click();

        await page.getByTestId("refundAddress").fill(await getLiquidAddress());

        await page.getByTestId("refundButton").click();
        expect(page.getByText("Swap has been refunded")).toBeDefined();
    });
});
