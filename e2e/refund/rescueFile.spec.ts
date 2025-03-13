import { Page, expect, test } from "@playwright/test";
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
    const existingFilePath = path.join(__dirname, "existingRescueFile.json");

    test.beforeAll(async () => {
        await generateLiquidBlock();
    });

    test.afterEach(() => {
        if (fs.existsSync(rescueFileJson)) {
            fs.unlinkSync(rescueFileJson);
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

    test("should create swaps with sequential key indicies after importing existing rescue file", async ({
        page,
    }) => {
        // Create a couple swaps
        for (let i = 0; i < 5; i++) {
            await page.goto("/");
            await setupSwapAssets(page);
            await fillSwapDetails(page);

            if (i === 0) {
                await page
                    .getByRole("button", { name: dict.en.verify_key })
                    .click();
                await page
                    .getByTestId("rescueFileUpload")
                    .setInputFiles(existingFilePath);
            }

            await page.getByText("address").click();
        }

        // Clear localStorage to force verification and rescan
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();

        await page.goto("/");
        await setupSwapAssets(page);
        await fillSwapDetails(page);

        await page.getByRole("button", { name: dict.en.verify_key }).click();
        await page
            .getByTestId("rescueFileUpload")
            .setInputFiles(existingFilePath);
        await page.getByText("address").click();

        const swaps = await getRescuableSwaps(existingFilePath);
        const keyIndices = swaps.map((swap) => swap.keyIndex);
        for (let i = 0; i < keyIndices.length - 1; i++) {
            expect(keyIndices[i + 1]).toEqual(keyIndices[i] + 1);
        }
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

    test(`should refund with rescue file`, async ({ page }) => {
        await createAndVerifySwap(page, rescueFileJson);

        const address = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        const amount = 1;
        await elementsSendToAddress(address, amount);

        // To make sure the backend has seen and rejected our tx
        await page.getByRole("heading", { name: "Lockup Failed!" }).click();

        await page.getByRole("link", { name: "Refund" }).click();
        await page
            .getByRole("button", { name: "Refund External Swap" })
            .click();

        await page.getByTestId("refundUpload").setInputFiles(rescueFileJson);
        await page.locator(".swaplist-item").first().click();

        await page.getByTestId("refundAddress").fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();

        const refundTxLink = page.getByText("open refund transaction");
        const txId = (await refundTxLink.getAttribute("href")).split("/").pop();
        expect(txId).toBeDefined();

        const txInfo = JSON.parse(await getElementsWalletTx(txId));
        expect(txInfo.amount.bitcoin).toBeGreaterThan(amount - 1_000);
    });
});
