import { devices, expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

import dict from "../../src/i18n/i18n";
import {
    elementsSendToAddress,
    generateLiquidBlock,
    getBolt12Offer,
    getElementsWalletTx,
    getLiquidAddress,
} from "../utils";

test.describe("Refund files", () => {
    const refundFileJson = path.join(__dirname, "refund.json");
    const refundFileQr = path.join(__dirname, "refund.png");

    test.beforeAll(async () => {
        await generateLiquidBlock();
    });

    test.afterAll(() => {
        for (const file of [refundFileJson, refundFileQr]) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
    });

    test("should show that no lockup transaction can be found", async ({
        page,
    }) => {
        await page.goto("/");

        await page.getByRole("link", { name: "Refund" }).click();
        await page
            .getByRole("button", { name: "Refund external swap" })
            .click();
        await page.getByTestId("refundUpload").click();

        await page
            .getByTestId("refundUpload")
            .setInputFiles(path.join(__dirname, "noLockup.png"));

        await expect(
            page.getByRole("button", { name: dict.en.no_lockup_transaction }),
        ).toBeVisible();
    });

    [
        { fileType: "JSON", isMobile: false },
        { fileType: "PNG QR code", isMobile: true },
    ].forEach(({ fileType, isMobile }) => {
        // The most data is created when swapping from Liquid to a BOLT12 invoice
        // If the QR code is readable in this case, the others should be fine as well
        test(`should refund with ${fileType} file`, async ({ browser }) => {
            const page = await (
                await browser.newContext({
                    ...(isMobile ? devices["Pixel 7"] : {}),
                })
            ).newPage();

            await page.goto("/");

            const refundFile = isMobile ? refundFileQr : refundFileJson;

            await page.locator(".arrow-down").first().click();
            await page.getByTestId("select-L-BTC").click();
            await page
                .locator(
                    "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
                )
                .click();
            await page.getByTestId("select-LN").click();

            await page.getByTestId("invoice").fill(await getBolt12Offer());
            await page.getByTestId("sendAmount").fill("0.005");
            await page.getByTestId("create-swap-button").click();

            const downloadPromise = page.waitForEvent("download");
            await page
                .getByRole("button", { name: "Download refund file" })
                .click();
            await (await downloadPromise).saveAs(refundFile);

            await page.getByText("address").click();
            const address = await page.evaluate(() => {
                return navigator.clipboard.readText();
            });
            const amount = 1;
            await elementsSendToAddress(address, amount);

            if (isMobile) {
                await page.locator("#hamburger").click();
            }
            await page.getByRole("link", { name: "Refund" }).click();
            await page
                .getByRole("button", { name: "Refund External Swap" })
                .click();

            await page.getByTestId("refundUpload").setInputFiles(refundFile);

            await page
                .getByTestId("refundAddress")
                .fill(await getLiquidAddress());
            await page.getByTestId("refundButton").click();

            const refundTxLink = page.getByText("open refund transaction");
            const txId = (await refundTxLink.getAttribute("href"))
                .split("/")
                .pop();
            expect(txId).toBeDefined();

            const txInfo = JSON.parse(await getElementsWalletTx(txId));
            expect(txInfo.amount.bitcoin).toBeGreaterThan(amount - 1_000);
        });
    });
});
