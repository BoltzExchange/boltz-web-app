import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
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
    generateLiquidBlocks,
    getBitcoinAddress,
    getBitcoinBlockHeight,
    getCurrentSwapId,
    getLiquidAddress,
    getLiquidBlockHeight,
    setFailedToPay,
    waitForBlockHeight,
    waitForNodesToSync,
    waitForUTXOs,
} from "../utils";

const fileName = "rescue.json";

const navigateToSwapDetails = async (page: Page, swapId: string) => {
    await page.getByRole("link", { name: "Rescue" }).click();
    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);
    await expect(page.getByTestId("loading-spinner")).not.toBeVisible({
        timeout: 15_000,
    });
    await expect(swapItem.getByRole("link", { name: "Refund" })).toBeVisible();
    await swapItem.click();
};

const setChainSwap = async (page: Page, sendAsset: string) => {
    await page.locator("div[class='asset asset-LN'] div").click();
    await page.getByTestId("select-BTC").click();
    await page.locator("div[class='asset asset-LN'] div").last().click();
    await page.getByTestId("select-L-BTC").click();
    const receiveAmount = "0.01";
    const inputReceiveAmount = page.locator(
        "input[data-testid='receiveAmount']",
    );
    await inputReceiveAmount.fill(receiveAmount);
    const inputOnchainAddress = page.locator(
        "input[data-testid='onchainAddress']",
    );
    await inputOnchainAddress.fill(
        sendAsset === BTC
            ? await getLiquidAddress()
            : await getBitcoinAddress(),
    );
};

const setSubmarineSwap = async (page: Page, sendAsset: string) => {
    await page.locator("div[class='asset asset-BTC'] div").click();
    await page.getByTestId(`select-${sendAsset}`).click();
    await page.locator("#flip-assets").click();
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

const createSwapAndGetDetails = async (
    page: Page,
    swapType: SwapType,
    asset: string,
) => {
    if (swapType === SwapType.Chain) {
        await setChainSwap(page, asset);
    } else {
        await setSubmarineSwap(page, asset);
    }

    const buttonCreateSwap = page.locator(
        "button[data-testid='create-swap-button']",
    );
    await expect(buttonCreateSwap).toBeEnabled();
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

const performBitcoinInitialPayment = async (
    address: string,
    sendAmount: string,
) => {
    await bitcoinSendToAddress(address, sendAmount);
    await generateBitcoinBlock();
    await waitForNodesToSync();
};

const performLiquidInitialPayment = async (
    address: string,
    sendAmount: string,
) => {
    await elementsSendToAddress(address, sendAmount);
    await generateLiquidBlock();
    await waitForNodesToSync();
};

const performBitcoinExpiredSwapSetup = async (
    swapType: SwapType,
    sendAsset: string,
    address: string,
    sendAmount: string,
) => {
    await bitcoinSendToAddress(address, sendAmount);
    await bitcoinSendToAddress(address, sendAmount);
    await waitForUTXOs(sendAsset as AssetType, address, 2);
    const currentHeight = await getBitcoinBlockHeight();
    if (swapType === SwapType.Chain) {
        const blocks = 26;
        await generateBitcoinBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    } else {
        const blocks = 120;
        await generateBitcoinBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    }
};

const performLiquidExpiredSwapSetup = async (
    swapType: SwapType,
    sendAsset: string,
    address: string,
    sendAmount: string,
) => {
    await elementsSendToAddress(address, sendAmount);
    await elementsSendToAddress(address, sendAmount);
    await waitForUTXOs(sendAsset as AssetType, address, 2);
    const currentHeight = await getLiquidBlockHeight();
    if (swapType === SwapType.Chain) {
        const blocks = 269;
        await generateLiquidBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    } else {
        const blocks = 1200;
        await generateLiquidBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    }
};

const executeRefund = async (
    page: Page,
    asset: string,
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
        await expect(page.getByTestId("loading-spinner")).not.toBeVisible({
            timeout: 15_000,
        });
    }

    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);
    await expect(swapItem).toBeVisible();
    await swapItem.click();

    const refundInput = page.locator("input[data-testid='refundAddress']");
    await expect(refundInput).toBeVisible();
    await refundInput.fill(
        asset === BTC ? await getBitcoinAddress() : await getLiquidAddress(),
    );

    const refundButton = page.locator("button[data-testid='refundButton']");
    await expect(refundButton).toBeEnabled();
    await refundButton.click();
};

const validateRefundTransaction = async (
    page: Page,
    sendAsset: string,
    address: string,
) => {
    const refundTxLink = page.getByText("open refund transaction");
    const txId = (await refundTxLink.getAttribute("href")).split("/").pop();

    expect(txId).toBeDefined();
    await waitForUTXOs(sendAsset as AssetType, address, 0); // check that all UTXOs were refunded
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
        { sendAsset: BTC, type: SwapType.Chain, external: false },
        { sendAsset: BTC, type: SwapType.Submarine, external: false },
        { sendAsset: BTC, type: SwapType.Chain, external: true },
        { sendAsset: BTC, type: SwapType.Submarine, external: true },
        { sendAsset: LBTC, type: SwapType.Chain, external: false },
        { sendAsset: LBTC, type: SwapType.Submarine, external: false },
        { sendAsset: LBTC, type: SwapType.Chain, external: true },
        { sendAsset: LBTC, type: SwapType.Submarine, external: true },
    ].forEach((swap) => {
        test(`Uncooperative refund expired ${swap.sendAsset} ${swap.type} swap via ${swap.external ? "External Rescue" : "Rescue"}`, async ({
            page,
        }) => {
            try {
                execSync("git apply --check --reverse boltz.conf.patch", {
                    stdio: "pipe",
                });
            } catch {
                console.error(`
                    (!) This test requires boltz.conf.patch to be applied.
                    It will fail without it due to the swap timeout being different from what's expected.
        
                    Please, run "git apply boltz.conf.patch" to apply the patch (or manually update your boltz.conf with the patch's values),
                    then restart your regtest containers.
                `);
            }

            test.setTimeout(60_000); // leave enough time for block generation
            await page.goto("/");

            await createSwapAndGetDetails(page, swap.type, swap.sendAsset);
            await backupRescueFile(page, fileName);

            const { address, sendAmount } = await getAddressAndAmount(page);
            const performInitialPayment =
                swap.sendAsset === BTC
                    ? performBitcoinInitialPayment
                    : performLiquidInitialPayment;
            await performInitialPayment(address, sendAmount);

            await expect(
                page.locator("div[data-status='transaction.claimed']"),
            ).toBeVisible({ timeout: 15_000 });

            await waitForUTXOs(swap.sendAsset as AssetType, address, 0);

            const swapId = getCurrentSwapId(page);

            if (swap.external) {
                await page.evaluate(() => window.localStorage.clear());
                await page.reload();
            }

            const performExpiredSwapSetup =
                swap.sendAsset === BTC
                    ? performBitcoinExpiredSwapSetup
                    : performLiquidExpiredSwapSetup;
            await performExpiredSwapSetup(
                swap.type,
                swap.sendAsset,
                address,
                sendAmount,
            );
            await executeRefund(page, swap.sendAsset, swapId, swap.external);
            await validateRefundTransaction(page, swap.sendAsset, address);
        });
    });
});
