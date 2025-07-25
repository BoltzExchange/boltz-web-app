import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import axios from "axios";
import fs from "fs";
import path from "path";

import { config } from "../../src/config";
import type { UTXO } from "../../src/utils/blockchain";
import {
    createAndVerifySwap,
    decodeLiquidRawTransaction,
    elementsSendToAddress,
    generateLiquidBlock,
    getLiquidAddress,
    setFailedToPay,
} from "../utils";

const getCurrentSwapId = (page: Page) => {
    const url = new URL(page.url());
    return url.pathname.split("/").pop();
};

const waitForUTXOsInMempool = async (address: string, amount: number) => {
    await expect
        .poll(
            async () => {
                const utxos = (
                    await axios.get<UTXO[]>(
                        `${config.assets["L-BTC"].blockExplorerApis[0].normal}/address/${address}/utxo`,
                    )
                ).data;

                return utxos.length === amount;
            },
            { timeout: 10_000 },
        )
        .toBe(true);
};

const navigateToSwapDetails = async (page: Page, swapId: string) => {
    await page.getByRole("link", { name: "Rescue" }).click();
    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);
    await expect(page.getByTestId("loading-spinner")).not.toBeVisible();
    await expect(swapItem.getByRole("link", { name: "Refund" })).toBeVisible();
    await swapItem.click();
};

const validateRefundTxInputs = async (page: Page, expectedInputs: number) => {
    const refundRequest = await page.waitForRequest((req) =>
        req.url().includes("/refund"),
    );
    const broadcastedTx = JSON.parse(refundRequest.postData() || "{}");

    const decodedTx = await decodeLiquidRawTransaction(
        broadcastedTx.transaction,
    );
    const tx = JSON.parse(decodedTx);

    expect(tx.vin.length).toBe(expectedInputs);
};

test.describe("Refund", () => {
    const refundFileJson = path.join(__dirname, "rescue.json");

    test.beforeEach(async () => {
        await generateLiquidBlock();
    });

    test.afterEach(() => {
        if (fs.existsSync(refundFileJson)) {
            fs.unlinkSync(refundFileJson);
        }
    });

    test("Refunds all UTXOs of `invoice.failedToPay`", async ({ page }) => {
        await createAndVerifySwap(page, refundFileJson);

        const swapId = getCurrentSwapId(page);

        const address = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        const amount = 0.005;
        const utxoCount = 3;

        await setFailedToPay(swapId);

        await elementsSendToAddress(address, amount);
        await elementsSendToAddress(address, amount);
        await elementsSendToAddress(address, amount);

        await waitForUTXOsInMempool(address, utxoCount);

        await navigateToSwapDetails(page, swapId);

        await expect(page.getByText("invoice.failedToPay")).toBeVisible();
        await page.getByTestId("refundAddress").fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();

        // Validate that the UTXOs are refunded on the same transaction
        await validateRefundTxInputs(page, utxoCount);

        const refundTxLink = page.getByText("open refund transaction");
        const txId = (await refundTxLink.getAttribute("href")).split("/").pop();

        expect(txId).toBeDefined();
    });

    test("Refunds all UTXOs of `transaction.lockupFailed`", async ({
        page,
    }) => {
        await createAndVerifySwap(page, refundFileJson);

        const swapId = getCurrentSwapId(page);

        const address = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        const amount = 0.01;
        const utxoCount = 2;

        // Pay swap with incorrect amount & pay additional UTXO
        await elementsSendToAddress(address, amount);
        await elementsSendToAddress(address, amount);

        await waitForUTXOsInMempool(address, utxoCount);

        await navigateToSwapDetails(page, swapId);

        await expect(page.getByText("transaction.lockupFailed")).toBeVisible();
        await page.getByTestId("refundAddress").fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();

        // Validate that the UTXOs are refunded on the same transaction
        await validateRefundTxInputs(page, utxoCount);

        const refundTxLink = page.getByText("open refund transaction");
        const txId = (await refundTxLink.getAttribute("href")).split("/").pop();

        expect(txId).toBeDefined();
    });
});
