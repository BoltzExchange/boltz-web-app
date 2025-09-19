import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

import { type AssetType, BTC, LBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import {
    backupRescueFile,
    bitcoinSendToAddress,
    createAndVerifySwap,
    decodeLiquidRawTransaction,
    elementsSendToAddress,
    generateBitcoinBlock,
    generateBitcoinBlocks,
    generateInvoiceLnd,
    generateLiquidBlock,
    getBitcoinAddress,
    getCurrentSwapId,
    getLiquidAddress,
    setFailedToPay,
    waitForNodesToSync,
    waitForUTXOs,
} from "../utils";

const fileName = "rescue.json";

const navigateToSwapDetails = async (page: Page, swapId: string) => {
    await page.getByRole("link", { name: "Rescue" }).click();
    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);
    await expect(page.getByTestId("loading-spinner")).not.toBeVisible();
    await expect(swapItem.getByRole("link", { name: "Refund" })).toBeVisible();
    await swapItem.click();
};

const setChainSwap = async (page: Page) => {
    await page.locator(".asset-wrap").first().click();
    await page.getByTestId("select-BTC").click();
    await page.locator(".asset-wrap").last().click();
    await page.getByTestId("select-L-BTC").click();
    const receiveAmount = "0.01";
    const inputReceiveAmount = page.locator(
        "input[data-testid='receiveAmount']",
    );
    await inputReceiveAmount.fill(receiveAmount);
    const inputOnchainAddress = page.locator(
        "input[data-testid='onchainAddress']",
    );
    await inputOnchainAddress.fill(await getLiquidAddress());
};

const setSubmarineSwap = async (page: Page) => {
    await page.locator(".asset-wrap").first().click();
    await page.getByTestId("select-BTC").click();
    await page.locator(".asset-wrap").last().click();
    await page.getByTestId("select-LN").click();
    const receiveAmount = "0.01";
    const inputReceiveAmount = page.locator(
        "input[data-testid='receiveAmount']",
    );
    await inputReceiveAmount.fill(receiveAmount);
    const invoiceInput = page.locator("textarea[data-testid='invoice']");
    const invoice = await generateInvoiceLnd(1000000);
    await invoiceInput.fill(invoice);
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

const createSwapAndGetDetails = async (page: Page, swapType: SwapType) => {
    if (swapType === SwapType.Chain) {
        await setChainSwap(page);
    } else {
        await setSubmarineSwap(page);
    }

    const buttonCreateSwap = page.locator(
        "button[data-testid='create-swap-button']",
    );
    await buttonCreateSwap.click();
};

const getAddressAndAmount = async (page: Page) => {
    await page.locator("p[data-testid='copy-box']").click();
    const address = await page.evaluate(() => {
        return navigator.clipboard.readText();
    });
    expect(address).toBeDefined();

    await page.getByTestId("pay-onchain-buttons").getByText("amount").click();

    const sendAmount = await page.evaluate(() => {
        return navigator.clipboard.readText();
    });

    return { address, sendAmount };
};

const performInitialPayment = async (address: string, sendAmount: string) => {
    await bitcoinSendToAddress(address, sendAmount);
    await generateBitcoinBlock();
    await waitForNodesToSync();
    await waitForUTXOs(BTC, address, 0);
};

const performExpiredSwapSetup = async (
    swapType: SwapType,
    address: string,
    sendAmount: string,
) => {
    if (swapType === SwapType.Chain) {
        await generateBitcoinBlocks(216);
    } else {
        await generateBitcoinBlocks(1006);
    }
    await waitForNodesToSync();
    await bitcoinSendToAddress(address, sendAmount);
    await bitcoinSendToAddress(address, sendAmount);
    await generateBitcoinBlock();
    await waitForNodesToSync();
    await waitForUTXOs(BTC, address, 2);
};

const executeRefund = async (
    page: Page,
    swapId: string,
    isExternalRescue = false,
) => {
    if (isExternalRescue) {
        await page.getByRole("link", { name: "Rescue" }).click();
        await page
            .getByRole("button", { name: "Rescue external swap" })
            .click();
        await page.getByTestId("refundUpload").setInputFiles(fileName);
    } else {
        await page.getByRole("link", { name: "Rescue" }).click();
        await expect(page.getByTestId("loading-spinner")).not.toBeVisible();
    }

    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);
    await expect(swapItem).toBeVisible();
    await swapItem.click();

    const refundInput = page.locator("input[data-testid='refundAddress']");
    await expect(refundInput).toBeVisible();
    await refundInput.fill(await getBitcoinAddress());

    const refundButton = page.locator("button[data-testid='refundButton']");
    await expect(refundButton).toBeEnabled();
    await refundButton.click();
};

const validateRefundTransaction = async (
    page: Page,
    asset: AssetType,
    address: string,
) => {
    const refundTxLink = page.getByText("open refund transaction");
    const txId = (await refundTxLink.getAttribute("href")).split("/").pop();

    expect(txId).toBeDefined();
    await waitForUTXOs(asset, address, 0); // check that all UTXOs were refunded
};

test.describe("Refund", () => {
    const refundFileJson = path.join(__dirname, fileName);

    test.beforeEach(async () => {
        await generateLiquidBlock();
    });

    test.afterEach(() => {
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
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

        await waitForUTXOs(LBTC, address, utxoCount);

        await navigateToSwapDetails(page, swapId);

        await expect(page.getByText("invoice.failedToPay")).toBeVisible();
        await page.getByTestId("refundAddress").fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();

        // Validate that the UTXOs are refunded on the same transaction
        await validateRefundTxInputs(page, utxoCount);
        await validateRefundTransaction(page, LBTC, address);
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

        await waitForUTXOs(LBTC, address, utxoCount);

        await navigateToSwapDetails(page, swapId);

        await expect(page.getByText("transaction.lockupFailed")).toBeVisible();
        await page.getByTestId("refundAddress").fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();

        // Validate that the UTXOs are refunded on the same transaction
        await validateRefundTxInputs(page, utxoCount);
        await validateRefundTransaction(page, LBTC, address);
    });

    [
        { type: SwapType.Chain, external: false },
        { type: SwapType.Submarine, external: false },
        { type: SwapType.Chain, external: true },
        { type: SwapType.Submarine, external: true },
    ].forEach((swap) => {
        test(`Uncooperative refund expired BTC ${swap.type} swap via ${swap.external ? "External Rescue" : "Rescue"}`, async ({
            page,
        }) => {
            test.setTimeout(60_000); // leave enough time for block generation
            await page.goto("/");

            await createSwapAndGetDetails(page, swap.type);
            await backupRescueFile(page, fileName);

            const { address, sendAmount } = await getAddressAndAmount(page);
            await performInitialPayment(address, sendAmount);

            const swapId = getCurrentSwapId(page);

            if (swap.external) {
                await page.evaluate(() => window.localStorage.clear());
                await page.reload();
            }

            await performExpiredSwapSetup(swap.type, address, sendAmount);
            await executeRefund(page, swapId, swap.external);
            await validateRefundTransaction(page, BTC, address);
        });
    });
});
