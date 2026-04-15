import { type Page, expect, test } from "@playwright/test";
import BigNumber from "bignumber.js";
import fs from "fs";
import path from "path";

import dict from "../src/i18n/i18n";
import { btcToSat } from "../src/utils/denomination";
import {
    generateBitcoinBlock,
    generateInvoiceLnd,
    verifyRescueFile,
    waitForNodesToSync,
} from "./utils";

test.describe("History", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await waitForNodesToSync();
    });

    const createSubmarineSwap = async (page: Page, receiveAmount: string) => {
        await page.goto("/");

        const sendAssetElement = page.getByTestId("asset-send");
        const sendAssetClass = await sendAssetElement.getAttribute("class");

        if (sendAssetClass?.includes("asset-LN")) {
            const divFlipAssets = page.locator("#flip-assets");
            await divFlipAssets.click();
        }

        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const invoiceInput = page.locator("textarea[data-testid='invoice']");
        const invoice = await generateInvoiceLnd(
            btcToSat(BigNumber(receiveAmount)).toNumber(),
        );
        await invoiceInput.fill(invoice);

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();
    };

    const createTwoSwaps = async (page: Page) => {
        await createSubmarineSwap(page, "0.01");

        await verifyRescueFile(page);

        await expect(
            page.locator("div[data-status='invoice.set']"),
        ).toBeVisible();

        const swapId1 = new URL(page.url()).pathname.split("/").pop();

        await createSubmarineSwap(page, "0.02");

        await expect(
            page.locator("div[data-status='invoice.set']"),
        ).toBeVisible();

        const swapId2 = new URL(page.url()).pathname.split("/").pop();

        await page.goto("/history");

        const swap1Item = page.getByTestId(`swaplist-item-${swapId1}`);
        const swap2Item = page.getByTestId(`swaplist-item-${swapId2}`);

        await expect(swap1Item).toBeVisible();
        await expect(swap2Item).toBeVisible();

        return { swap1Item, swap2Item, swapId1, swapId2 };
    };

    test("Create two swaps, verify in history, delete one", async ({
        page,
    }) => {
        const { swap1Item, swap2Item, swapId1 } = await createTwoSwaps(page);

        page.on("dialog", async (dialog) => {
            expect(dialog.type()).toBe("confirm");
            await dialog.accept();
        });

        const deleteButton1 = page.getByTestId(`delete-swap-${swapId1}`);
        await expect(deleteButton1).toBeVisible();
        await expect(deleteButton1).toBeEnabled();
        await deleteButton1.click();

        await expect(swap1Item).not.toBeVisible();
        await expect(swap2Item).toBeVisible();

        // Verify only one swap remains in the list
        const swapListItems = page.locator('[data-testid^="swaplist-item-"]');
        await expect(swapListItems).toHaveCount(1);
    });

    test("Create two swaps, export, and delete storage", async ({ page }) => {
        const { swap1Item, swap2Item } = await createTwoSwaps(page);

        const exportFileName = path.join(__dirname, "export.json");
        const downloadPromise = page.waitForEvent("download");
        await page
            .getByRole("button", { name: dict.en.history_export })
            .click();
        const download = await downloadPromise;
        await download.saveAs(exportFileName);

        expect(fs.existsSync(exportFileName)).toBe(true);

        page.on("dialog", async (dialog) => {
            expect(dialog.type()).toBe("confirm");
            await dialog.accept();
        });

        await page.getByRole("button", { name: dict.en.refund_clear }).click();

        await expect(swap1Item).not.toBeVisible();
        await expect(swap2Item).not.toBeVisible();

        await expect(page.getByText(dict.en.history_no_swaps)).toBeVisible();

        if (fs.existsSync(exportFileName)) {
            fs.unlinkSync(exportFileName);
        }
    });
});
