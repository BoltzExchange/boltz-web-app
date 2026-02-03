import fs from "fs";
import { BTC } from "src/consts/Assets";

import dict from "../../src/i18n/i18n";
import { expect, test } from "../fixtures/ethereum";
import {
    bitcoinSendToAddress,
    generateAnvilBlock,
    generateBitcoinBlock,
    generateBitcoinBlocks,
    getBitcoinAddress,
    getBitcoinBlockHeight,
    waitForBlockHeight,
    waitForNodesToSync,
} from "../utils";

const rescueFileName = "rescue-file.json";

test.describe("RSK Rescue", () => {
    test.beforeEach(async ({ injectProvider }) => {
        await injectProvider();
        await generateBitcoinBlock();
        await generateAnvilBlock();
    });

    test.afterEach(() => {
        if (fs.existsSync(rescueFileName)) {
            fs.unlinkSync(rescueFileName);
        }
    });

    test("BTC -> RBTC: Claim pending swap via rescue page", async ({
        page,
        walletClient,
    }) => {
        await page.goto("/");

        const assetSelectors = page.locator("div[class^='asset asset-']");
        await assetSelectors.first().click();
        await page.locator("div[data-testid='select-BTC']").click();

        await assetSelectors.last().click();
        await page.locator("div[data-testid='select-RBTC']").click();

        await page
            .getByRole("button", {
                name: dict.en.connect_wallet,
                exact: true,
            })
            .click();

        const modal = page.locator("[data-testid='wallet-connect-modal']");
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.getByText(/metamask/i).click();
        }

        const shortAddress = walletClient.account.address.slice(0, 8);
        await expect(page.locator(`text=${shortAddress}`)).toBeVisible({
            timeout: 10_000,
        });

        const receiveAmount = "0.001";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        await expect(inputSendAmount).not.toHaveValue("");
        const sendAmount = await inputSendAmount.inputValue();

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await expect(buttonCreateSwap).toBeEnabled({ timeout: 5000 });
        await buttonCreateSwap.click();

        const downloadPromise = page.waitForEvent("download");
        await page
            .getByRole("button", { name: dict.en.download_new_key })
            .click();
        await (await downloadPromise).saveAs(rescueFileName);

        await page
            .getByTestId("rescueFileUpload")
            .setInputFiles(rescueFileName);

        await expect(
            page.locator("div[data-status='swap.created']"),
        ).toBeVisible({ timeout: 15_000 });

        const copyAddressButton = page
            .locator("div[data-testid='pay-onchain-buttons']")
            .getByText("address");
        await copyAddressButton.click();

        const lockupAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(lockupAddress).toBeDefined();

        await bitcoinSendToAddress(lockupAddress, sendAmount);
        await generateBitcoinBlock();
        await page.waitForTimeout(500);
        await generateAnvilBlock();

        await page.evaluate(() => {
            window.localStorage.clear();
            indexedDB.deleteDatabase("swaps");
        });
        await page.reload();

        await page.goto("/rescue");

        await page
            .getByRole("button", { name: dict.en.rescue_external_swap })
            .click();

        await page.getByText("Rootstock").click();

        await page.getByTestId("rsk-rescue-resume-button").click();

        await page.getByTestId("refundUpload").setInputFiles(rescueFileName);

        const connectWalletBtn = page.getByRole("button", {
            name: dict.en.connect_wallet,
            exact: true,
        });
        if (
            await connectWalletBtn
                .isVisible({ timeout: 2000 })
                .catch(() => false)
        ) {
            await connectWalletBtn.click();

            const connectModal = page.locator(
                "[data-testid='wallet-connect-modal']",
            );
            if (
                await connectModal
                    .isVisible({ timeout: 2000 })
                    .catch(() => false)
            ) {
                await page.getByText(/metamask/i).click();
            }
        }

        await expect(page.getByText(/Scan progress/)).toBeVisible({
            timeout: 60_000,
        });

        const swapListItem = page.locator(".swaplist-item").first();
        await expect(swapListItem).toBeVisible({ timeout: 120_000 });
        await swapListItem.click();

        await page.waitForTimeout(500);
        await generateAnvilBlock();

        const continueButton = page.getByRole("button", {
            name: dict.en.continue,
        });
        await expect(continueButton).toBeVisible({ timeout: 10_000 });
        await continueButton.click();

        await generateAnvilBlock();

        await expect(page.getByText(dict.en.claimed)).toBeVisible({
            timeout: 15_000,
        });
    });

    test("RBTC -> BTC: Refund expired swap via rescue page", async ({
        page,
        walletClient,
    }) => {
        test.setTimeout(60_000);
        await page.goto("/");

        const assetSelectors = page.locator("div[class^='asset asset-']");
        await assetSelectors.first().click();
        await page.locator("div[data-testid='select-RBTC']").click();

        await assetSelectors.last().click();
        await page.locator("div[data-testid='select-BTC']").click();

        await page
            .getByRole("button", {
                name: dict.en.connect_wallet,
                exact: true,
            })
            .click();

        const modal = page.locator("[data-testid='wallet-connect-modal']");
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.getByText(/metamask/i).click();
        }

        const shortAddress = walletClient.account.address.slice(0, 8);
        await expect(page.locator(`text=${shortAddress}`)).toBeVisible({
            timeout: 10_000,
        });

        const btcAddress = await getBitcoinAddress();
        const inputOnchainAddress = page.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(btcAddress);

        const receiveAmount = "0.001";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        await expect(inputSendAmount).not.toHaveValue("");

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await expect(buttonCreateSwap).toBeEnabled({ timeout: 5000 });
        await buttonCreateSwap.click();

        await expect(
            page.locator("div[data-status='swap.created']"),
        ).toBeVisible({ timeout: 15_000 });

        await page.getByRole("button", { name: "Send" }).click();
        await page.evaluate(() => {
            window.localStorage.clear();
            indexedDB.deleteDatabase("swaps");
        });
        await page.reload();

        await generateAnvilBlock(600);
        await page.waitForTimeout(1000);

        const currentHeight = await getBitcoinBlockHeight();
        const blocks = 26;
        await generateBitcoinBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(BTC, currentHeight + blocks);

        await page.goto("/rescue");

        await page
            .getByRole("button", { name: dict.en.rescue_external_swap })
            .click();

        await page.getByText("Rootstock").click();

        await page.getByTestId("rsk-rescue-refund-button").click();

        const connectWalletBtn = page.getByRole("button", {
            name: dict.en.connect_wallet,
            exact: true,
        });
        if (
            await connectWalletBtn
                .isVisible({ timeout: 2000 })
                .catch(() => false)
        ) {
            await connectWalletBtn.click();

            const connectModal = page.locator(
                "[data-testid='wallet-connect-modal']",
            );
            if (
                await connectModal
                    .isVisible({ timeout: 2000 })
                    .catch(() => false)
            ) {
                await page.getByText(/metamask/i).click();
            }
        }

        await expect(page.getByText(/Scan progress/)).toBeVisible({
            timeout: 60_000,
        });

        const swapListItem = page.locator(".swaplist-item").first();
        await expect(swapListItem).toBeVisible({ timeout: 120_000 });
        await swapListItem.click();

        const refundButton = page.getByRole("button", {
            name: dict.en.refund,
        });
        await expect(refundButton).toBeVisible({ timeout: 10_000 });
        await refundButton.click();

        await generateAnvilBlock();

        await expect(page.getByText(dict.en.refunded)).toBeVisible({
            timeout: 15_000,
        });
    });
});
