import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "fs";

import { BTC, LBTC } from "../../src/consts/Assets";
import {
    backupRescueFile,
    bitcoinSendToAddress,
    elementsSendToAddress,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
    getCurrentSwapId,
    getLiquidAddress,
    payInvoiceLndBackground,
    waitForNodesToSync,
} from "../utils";

const fileName = "rescue-file.json";

const clearStorage = async (page: Page) => {
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
};

const claimPendingSwap = async ({
    page,
    asset,
    swapId,
}: {
    page: Page;
    asset: string;
    swapId: string;
}) => {
    await page.getByRole("link", { name: "Rescue" }).click();

    await page.getByRole("button", { name: "Rescue external swap" }).click();

    await page.getByTestId("refundUpload").setInputFiles(fileName);

    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);

    await expect(swapItem).toBeVisible();
    await expect(swapItem).not.toBeDisabled();

    await swapItem.click();

    const inputOnchainAddress = page.locator(
        "input[data-testid='onchainAddress']",
    );

    await inputOnchainAddress.fill(
        asset === BTC ? await getBitcoinAddress() : await getLiquidAddress(),
    );

    await page.getByRole("button", { name: "Claim" }).click();

    await expect(page.getByTestId("claimed")).toBeVisible();
};

const createChainSwap = async (page: Page, assetSend: string) => {
    await page.goto("/");

    const assetSelector = page.locator("div[class='asset asset-LN'] div");
    await assetSelector.click();

    const lbtcAsset = page.locator("div[data-testid='select-L-BTC']");
    await lbtcAsset.click();

    if (assetSend === BTC) {
        const divFlipAssets = page.locator("#flip-assets");
        await divFlipAssets.click();
    }

    const receiveAmount = "0.01";
    const inputReceiveAmount = page.locator(
        "input[data-testid='receiveAmount']",
    );
    await inputReceiveAmount.fill(receiveAmount);

    const inputSendAmount = await page
        .locator("input[data-testid='sendAmount']")
        .inputValue();

    const inputOnchainAddress = page.locator(
        "input[data-testid='onchainAddress']",
    );
    await inputOnchainAddress.fill(
        assetSend === BTC
            ? await getLiquidAddress()
            : await getBitcoinAddress(),
    );

    const buttonCreateSwap = page.locator(
        "button[data-testid='create-swap-button']",
    );
    await buttonCreateSwap.click();

    return inputSendAmount;
};

test.describe("Claim", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test.afterEach(() => {
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
    });

    [
        { assetSend: BTC, assetReceive: LBTC },
        { assetSend: LBTC, assetReceive: BTC },
    ].forEach(({ assetSend, assetReceive }) => {
        test(`${assetSend} -> ${assetReceive}: Claim pending chain swap via rescue key scan`, async ({
            page,
        }) => {
            const sendAmount = await createChainSwap(page, assetSend);

            await backupRescueFile(page, fileName);

            await page.locator("p[data-testid='copy-box']").click();

            const address = await page.evaluate(() => {
                return navigator.clipboard.readText();
            });

            const swapId = getCurrentSwapId(page);

            await clearStorage(page);

            if (assetSend === BTC) {
                await bitcoinSendToAddress(address, sendAmount);
                await generateBitcoinBlock();
                await waitForNodesToSync();
            }

            if (assetSend === LBTC) {
                await elementsSendToAddress(address, sendAmount);
                await generateLiquidBlock();
                await waitForNodesToSync();
            }

            await claimPendingSwap({
                page,
                swapId,
                asset: assetReceive,
            });
        });
    });

    [BTC, LBTC].forEach((asset) => {
        test(`${asset}: Claim pending reverse swap via rescue key scan`, async ({
            page,
        }) => {
            await page.goto("/");

            const receiveAmount = "0.01";
            const inputReceiveAmount = page.locator(
                "input[data-testid='receiveAmount']",
            );
            await inputReceiveAmount.fill(receiveAmount);

            const inputOnchainAddress = page.locator(
                "input[data-testid='onchainAddress']",
            );

            if (asset === BTC) {
                await inputOnchainAddress.fill(await getBitcoinAddress());
            }

            if (asset === LBTC) {
                const assetSelector = page.locator(
                    "div[class='asset asset-BTC'] div",
                );
                await assetSelector.click();

                const lbtcAsset = page.locator(
                    "div[data-testid='select-L-BTC']",
                );
                await lbtcAsset.click();

                await inputOnchainAddress.fill(await getLiquidAddress());
            }

            const buttonCreateSwap = page.locator(
                "button[data-testid='create-swap-button']",
            );
            await buttonCreateSwap.click();

            const spanLightningInvoice = page.locator("span[class='btn']");
            await spanLightningInvoice.click();

            const lightningInvoice = await page.evaluate(() => {
                return navigator.clipboard.readText();
            });
            expect(lightningInvoice).toBeDefined();

            const swapId = getCurrentSwapId(page);

            const settings = page.locator("span[data-testid='settings-cog']");

            await settings.click();

            const downloadPromise = page.waitForEvent("download");

            await page
                .locator("div[data-testid='rescue-key-download']")
                .click();
            await (await downloadPromise).saveAs(fileName);

            await clearStorage(page);

            payInvoiceLndBackground(lightningInvoice);
            await waitForNodesToSync();

            if (asset === BTC) {
                await generateBitcoinBlock();
                await waitForNodesToSync();
            }

            if (asset === LBTC) {
                await generateLiquidBlock();
                await waitForNodesToSync();
            }

            await claimPendingSwap({
                page,
                swapId,
                asset,
            });
        });
    });
});
