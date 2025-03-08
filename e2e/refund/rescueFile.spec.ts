import { Page, devices, expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

import dict from "../../src/i18n/i18n";
import { getRescuableSwaps } from "../boltzClient";
import {
    elementsSendToAddress,
    generateLiquidBlock,
    getBolt12Offer,
    getElementsWalletTx,
    getLiquidAddress,
} from "../utils";

const setupSwapAssets = async (page: Page) => {
    await page.locator(".arrow-down").first().click();
    await page.getByTestId("select-L-BTC").click();
    await page
        .locator(
            "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
        )
        .click();
    await page.getByTestId("select-LN").click();
};

const fillSwapDetails = async (page: Page) => {
    await page.getByTestId("invoice").fill(await getBolt12Offer());
    await page.getByTestId("sendAmount").fill("0.005");
    await page.getByTestId("create-swap-button").click();
};

const createAndVerifySwap = async (page: Page, rescueFile: string) => {
    await page.goto("/");
    await setupSwapAssets(page);
    await fillSwapDetails(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: dict.en.download_new_key }).click();
    await (await downloadPromise).saveAs(rescueFile);

    await page.getByTestId("rescueFileUpload").setInputFiles(rescueFile);
    await page.getByText("address").click();
};

test.describe("Rescue file", () => {
    const rescueFileJson = path.join(__dirname, "rescue.json");
    const rescueFileQr = path.join(__dirname, "rescue.png");
    const existingFilePath = path.join(__dirname, "existingRescueFile.json");

    test.beforeAll(async () => {
        await generateLiquidBlock();
    });

    test.afterEach(() => {
        for (const file of [rescueFileJson, rescueFileQr]) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
    });

    test("should show error when wrong rescue file was uploaded", async ({
        page,
    }) => {
        await page.goto("/");
        await setupSwapAssets(page);
        await fillSwapDetails(page);
        await page
            .getByRole("button", { name: dict.en.download_new_key })
            .click();

        await page
            .getByTestId("rescueFileUpload")
            .setInputFiles(existingFilePath);
        await page.getByText(dict.en.verify_key_failed).click();
    });

    test("should create swap after new backup download", async ({ page }) => {
        await createAndVerifySwap(page, rescueFileJson);
        // Verify that the swap was created
        expect(await getRescuableSwaps(rescueFileJson)).toHaveLength(1);
    });

    test("should create swap after existing backup verification", async ({
        page,
    }) => {
        const existingSwaps = await getRescuableSwaps(existingFilePath);

        await page.goto("/");
        await setupSwapAssets(page);
        await fillSwapDetails(page);

        await page.getByRole("button", { name: dict.en.verify_key }).click();
        await page
            .getByTestId("rescueFileUpload")
            .setInputFiles(existingFilePath);
        await page.getByText("address").click();

        // Verify that a new swap was created
        expect(await getRescuableSwaps(existingFilePath)).toHaveLength(
            existingSwaps.length + 1,
        );
    });

    test("should show entries for swaps with no lockup transaction as disabled", async ({
        page,
    }) => {
        await createAndVerifySwap(page, rescueFileJson);

        await page.getByRole("link", { name: "Refund" }).click();
        await page
            .getByRole("button", { name: "Refund External Swap" })
            .click();

        await page.getByTestId("refundUpload").setInputFiles(rescueFileJson);
        const entry = page.locator(".swaplist-item").first();
        await expect(entry).toHaveClass("swaplist-item disabled");
    });

    [
        { fileType: "JSON", isMobile: false },
        { fileType: "PNG QR code", isMobile: true },
    ].forEach(({ fileType, isMobile }) => {
        test(`should refund with ${fileType} file`, async ({ browser }) => {
            const page = await (
                await browser.newContext({
                    ...(isMobile ? devices["Pixel 7"] : {}),
                })
            ).newPage();

            const rescueFile = isMobile ? rescueFileQr : rescueFileJson;
            await createAndVerifySwap(page, rescueFile);

            const address = await page.evaluate(() => {
                return navigator.clipboard.readText();
            });
            const amount = 1;
            await elementsSendToAddress(address, amount);

            // To make sure the backend has seen and rejected our tx
            await page.getByRole("heading", { name: "Lockup Failed!" }).click();

            if (isMobile) {
                await page.locator("#hamburger").click();
            }
            await page.getByRole("link", { name: "Refund" }).click();
            await page
                .getByRole("button", { name: "Refund External Swap" })
                .click();

            await page.getByTestId("refundUpload").setInputFiles(rescueFile);
            await page.locator(".swaplist-item").first().click();

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
