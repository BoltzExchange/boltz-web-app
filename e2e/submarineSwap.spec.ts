import { expect, test } from "@playwright/test";

import {
    bitcoinSendToAddress,
    generateBitcoinBlock,
    generateInvoiceLnd,
    lookupInvoiceLnd,
    verifyRescueFile,
    waitForNodesToSync,
} from "./utils";

test.describe("Submarine swap", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await waitForNodesToSync();
    });

    test("Submarine swap BTC/BTC", async ({ page }) => {
        await page.goto("/");

        const divFlipAssets = page.locator("#flip-assets");
        await divFlipAssets.click();

        const receiveAmount = "0.01";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        const sendAmount = "0.01001302";
        await expect(inputSendAmount).toHaveValue(sendAmount);

        const invoiceInput = page.locator("textarea[data-testid='invoice']");
        const invoice = await generateInvoiceLnd(1000000);
        await invoiceInput.fill(invoice);
        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        await verifyRescueFile(page);

        const copyAddressButton = page.getByText("address");
        expect(copyAddressButton).toBeDefined();
        await copyAddressButton.click();

        const sendAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(sendAddress).toBeDefined();
        await bitcoinSendToAddress(sendAddress, sendAmount);

        await generateBitcoinBlock();

        const validationLink = new URL(
            await page.getByText("Show Proof of Payment").getAttribute("href"),
        );

        expect(validationLink.searchParams.get("invoice")).toEqual(invoice);
        const preimage = validationLink.searchParams.get("preimage");

        const lookupRes = await lookupInvoiceLnd(invoice);
        expect(lookupRes.state).toEqual("SETTLED");
        expect(lookupRes.r_preimage).toEqual(preimage);
    });

    test("Create with LNURL", async ({ page }) => {
        await page.goto("/");

        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
            )
            .click();
        await page.getByTestId("select-LN").click();
        await page.locator(".asset-wrap").first().click();
        await page.getByTestId("select-L-BTC").click();

        await page.getByTestId("invoice").click();
        await page
            .getByTestId("invoice")
            .fill(
                "LNURL1DP68GUP69UHNZV3H9CCZUVPWXYARXVPSXQHKZURF9AKXUATJD3CQQKE2EU",
            );

        await page.getByTestId("sendAmount").fill("50 0000");

        await page.getByTestId("create-swap-button").click();
        // When we can click that button, the swap was created
        await verifyRescueFile(page);
    });
});
