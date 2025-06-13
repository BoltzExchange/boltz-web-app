import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import BigNumber from "bignumber.js";

import { Denomination } from "../src/consts/Enums";
import { formatAmount } from "../src/utils/denomination";
import {
    generateInvoiceLnd,
    getBitcoinAddress,
    getLiquidAddress,
} from "./utils";

const toggleRescueModeOnClick = async (page: Page) => {
    const modeRescueKeyParam = /\?mode=rescue-key/;

    await page.getByTestId("enterMnemonicBtn").click();
    await expect(page.getByTestId("mnemonic-input-0")).toBeVisible();
    await expect(page).toHaveURL(modeRescueKeyParam);

    await page.getByTestId("backBtn").click();
    await expect(page.getByTestId("mnemonic-input-0")).not.toBeVisible();
    await expect(page).not.toHaveURL(modeRescueKeyParam);
};

test.describe("URL params", () => {
    test("BTC address destination", async ({ page }) => {
        const address = await getBitcoinAddress();

        await page.goto(`/?destination=${address}`);
        const receiveAsset = page.locator(".asset-BTC");
        expect(receiveAsset).toBeDefined();

        const onchainAddress = page.getByTestId("onchainAddress");
        await expect(onchainAddress).toHaveValue(address);
    });

    test("L-BTC address destination", async ({ page }) => {
        const address = await getLiquidAddress();

        await page.goto(`/?destination=${address}`);
        const receiveAsset = page.locator(".asset-L-BTC");
        expect(receiveAsset).toBeDefined();

        const onchainAddress = page.getByTestId("onchainAddress");
        await expect(onchainAddress).toHaveValue(address);
    });

    test("Lightning invoice destination", async ({ page }) => {
        const amount = 100_000;
        const invoice = await generateInvoiceLnd(amount);

        await page.goto(`/?destination=${invoice}`);
        const receiveAsset = page.locator(".asset-LN");
        expect(receiveAsset).toBeDefined();

        const invoiceInput = page.getByTestId("invoice");
        await expect(invoiceInput).toHaveValue(invoice);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(amount), Denomination.Sat, "."),
        );
    });

    test("should set send amount", async ({ page }) => {
        const amount = 210_000;
        await page.goto(`/?sendAmount=${amount}`);

        const sendAmount = page.getByTestId("sendAmount");
        await expect(sendAmount).toHaveValue(
            formatAmount(BigNumber(amount), Denomination.Sat, "."),
        );
    });

    test("should set receive amount", async ({ page }) => {
        const amount = 210_000;
        await page.goto(`/?receiveAmount=${amount}`);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(amount), Denomination.Sat, "."),
        );
    });

    test("should not set receive amount when send amount is set", async ({
        page,
    }) => {
        const sendAmount = 100_000;
        const receiveAmount = 210_000;
        await page.goto(
            `/?sendAmount=${sendAmount}&receiveAmount=${receiveAmount}`,
        );

        const sendAmountInput = page.getByTestId("sendAmount");
        await expect(sendAmountInput).toHaveValue(
            formatAmount(BigNumber(sendAmount), Denomination.Sat, "."),
        );
    });

    test("should not set amount when lightning invoice is set", async ({
        page,
    }) => {
        const invoiceAmount = 200_000;
        const invoice = await generateInvoiceLnd(invoiceAmount);

        const sendAmount = 100_000;

        await page.goto(`/?sendAmount=${sendAmount}&destination=${invoice}`);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(invoiceAmount), Denomination.Sat, "."),
        );
    });

    test("should use `?mode=rescue-key` param to display mnemonic input", async ({
        page,
    }) => {
        const assertMnemonicVisible = async () => {
            await expect(page.getByTestId("mnemonic-input-0")).toBeVisible();
        };

        await page.goto("/");
        await page.getByRole("link", { name: "Refund" }).click();
        await page
            .getByRole("button", { name: "Refund External Swap" })
            .click();

        await toggleRescueModeOnClick(page);

        await page.goto("/backup/verify/existing");

        await toggleRescueModeOnClick(page);

        await page.goto("/refund/external?mode=rescue-key");
        await assertMnemonicVisible();

        await page.goto("/backup/verify/existing?mode=rescue-key");
        await assertMnemonicVisible();
    });
});
