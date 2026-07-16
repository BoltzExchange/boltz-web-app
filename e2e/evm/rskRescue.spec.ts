import type { Page } from "@playwright/test";
import fs from "fs";
import type { WalletClient } from "viem";

import dict from "../../src/i18n/i18n";
import { expect, test } from "../fixtures/ethereum";
import {
    bitcoinSendToAddress,
    checkBoltzConfPatch,
    generateAnvilBlock,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
} from "../utils";

const connectWallet = async (
    page: Page,
    walletClient: WalletClient,
    options?: { waitForAddress?: boolean },
) => {
    const connectBtn = page.getByRole("button", {
        name: dict.en.connect_wallet,
        exact: true,
    });
    await connectBtn.click();
    const modal = page.locator("[data-testid='wallet-connect-modal']");
    await expect(modal).toBeVisible();
    await page.getByText(/metamask/i).click();

    if (options?.waitForAddress !== false) {
        const shortAddress = walletClient.account!.address.slice(0, 8);
        await expect(page.locator(`text=${shortAddress}`)).toBeVisible();
    }
};

const selectAssets = async (
    page: Page,
    sendAsset: string,
    receiveAsset: string,
) => {
    const assetSelectors = page.locator("div[class^='asset asset-']");
    await assetSelectors.first().click();
    await page.getByTestId(`select-${sendAsset}`).click();

    await assetSelectors.last().click();
    await page.getByTestId(`select-${receiveAsset}`).click();
};

const fillReceiveAmount = async (page: Page, amount: string) => {
    await page.locator("input[data-testid='receiveAmount']").fill(amount);

    const inputSendAmount = page.locator("input[data-testid='sendAmount']");
    await expect(inputSendAmount).not.toHaveValue("");
    return inputSendAmount.inputValue();
};

const clickCreateSwap = async (page: Page) => {
    const buttonCreateSwap = page.locator(
        "button[data-testid='create-swap-button']",
    );
    await expect(buttonCreateSwap).toBeEnabled();
    await buttonCreateSwap.click();
};

const downloadAndVerifyRescueFile = async (
    page: Page,
    rescueFilePath: string,
) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: dict.en.download_new_key }).click();
    const download = await downloadPromise;
    await download.saveAs(rescueFilePath);

    expect(fs.existsSync(rescueFilePath)).toBe(true);

    await page.getByTestId("rescueFileUpload").setInputFiles(rescueFilePath);
};

const waitForSwapCreated = async (page: Page) => {
    await expect(page.locator("div[data-status='swap.created']")).toBeVisible();
};

const waitForLockupConfirmed = async (
    page: Page,
    sendAsset: string,
    receiveAsset: string,
) => {
    let status: string;
    if (sendAsset === "BTC" && receiveAsset === "RBTC") {
        status = "transaction.server.confirmed";
    } else if (sendAsset === "RBTC" && receiveAsset === "BTC") {
        status = "transaction.claim.pending";
    } else {
        throw new Error(
            `waitForLockupConfirmed: unsupported asset pair ${sendAsset} -> ${receiveAsset}`,
        );
    }

    const success = page.locator(`div[data-status='${status}']`);
    const failed = page.locator("div[data-status='transaction.failed']");
    await expect(success.or(failed)).toBeVisible({ timeout: 30_000 });
};

const copyLockupAddress = async (page: Page) => {
    await page
        .locator("div[data-testid='pay-onchain-buttons']")
        .getByText("address")
        .click();

    const lockupAddress = await page.evaluate(() =>
        navigator.clipboard.readText(),
    );
    expect(lockupAddress).toBeDefined();
    return lockupAddress;
};

const enterMnemonic = async (page: Page, mnemonic: string) => {
    await page.getByRole("button", { name: dict.en.enter_mnemonic }).click();
    const firstInput = page.getByTestId("mnemonic-input-0");
    await expect(firstInput).toBeVisible();
    await firstInput.focus();
    await page.evaluate(
        (text) => navigator.clipboard.writeText(text),
        mnemonic,
    );
    await firstInput.press("ControlOrMeta+v");
    await expect(
        page.getByRole("button", { name: dict.en.rescue, exact: true }),
    ).toBeEnabled();
};

const clearBrowserStorage = async (page: Page) => {
    await page.evaluate(() => {
        window.localStorage.clear();
        indexedDB.deleteDatabase("swaps");
        indexedDB.deleteDatabase("lastUsedEvmIndex");
    });
    await page.reload();
};

const navigateToRskRescue = async (page: Page) => {
    await page.goto("/rescue");
};

const selectAndClickSwapItem = async (
    page: Page,
    action: "Claim" | "Refund",
) => {
    const label = action === "Claim" ? dict.en.claim : dict.en.refund;
    const swapListItem = page
        .locator(".rescue-external-results .swaplist-item")
        .filter({
            has: page.getByRole("link", { name: label, exact: true }),
        })
        .first();
    await expect(swapListItem).toBeVisible({ timeout: 30_000 });
    await swapListItem.click();
};

test.describe("RSK Rescue", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ injectProvider }) => {
        checkBoltzConfPatch();
        await injectProvider();
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("BTC -> RBTC: Claim pending swap via rescue page", async ({
        page,
        walletClient,
    }, testInfo) => {
        const rescueFileName = testInfo.outputPath("rescue-file.json");
        test.setTimeout(60_000);
        await page.goto("/");

        await selectAssets(page, "BTC", "RBTC");
        await connectWallet(page, walletClient);

        const sendAmount = await fillReceiveAmount(page, "0.001");
        await clickCreateSwap(page);
        await downloadAndVerifyRescueFile(page, rescueFileName);
        await waitForSwapCreated(page);

        const lockupAddress = await copyLockupAddress(page);

        await bitcoinSendToAddress(lockupAddress, sendAmount);
        await generateBitcoinBlock();
        await waitForLockupConfirmed(page, "BTC", "RBTC");

        await clearBrowserStorage(page);

        await navigateToRskRescue(page);
        await page.getByTestId("refundUpload").setInputFiles(rescueFileName);
        await connectWallet(page, walletClient, { waitForAddress: false });
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
        await selectAndClickSwapItem(page, "Claim");

        const continueButton = page.getByRole("button", {
            name: dict.en.continue,
        });
        await expect(continueButton).toBeVisible();
        await continueButton.click();

        await expect(page.getByText(dict.en.claimed)).toBeVisible();
    });

    test("BTC -> RBTC: Claim pending swap via rescue page using mnemonic input", async ({
        page,
        walletClient,
    }, testInfo) => {
        const rescueFileName = testInfo.outputPath("rescue-file.json");
        test.setTimeout(60_000);
        await page.goto("/");

        await selectAssets(page, "BTC", "RBTC");
        await connectWallet(page, walletClient);

        const sendAmount = await fillReceiveAmount(page, "0.001");
        await clickCreateSwap(page);
        await downloadAndVerifyRescueFile(page, rescueFileName);
        await waitForSwapCreated(page);

        const lockupAddress = await copyLockupAddress(page);

        await bitcoinSendToAddress(lockupAddress, sendAmount);
        await generateBitcoinBlock();
        await waitForLockupConfirmed(page, "BTC", "RBTC");

        const rescueFileContent = JSON.parse(
            fs.readFileSync(rescueFileName, "utf8"),
        );

        await clearBrowserStorage(page);

        await navigateToRskRescue(page);
        await enterMnemonic(page, rescueFileContent.mnemonic);
        await connectWallet(page, walletClient, { waitForAddress: false });
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
        await selectAndClickSwapItem(page, "Claim");

        const continueButton = page.getByRole("button", {
            name: dict.en.continue,
        });
        await expect(continueButton).toBeVisible();
        await continueButton.click();

        await expect(page.getByText(dict.en.claimed)).toBeVisible();
    });

    test("RBTC -> BTC: Refund expired swap via rescue page", async ({
        page,
        walletClient,
    }, testInfo) => {
        const rescueFileName = testInfo.outputPath("rescue-file.json");
        test.setTimeout(60_000);
        await page.goto("/");

        await selectAssets(page, "RBTC", "BTC");
        await connectWallet(page, walletClient);

        const btcAddress = await getBitcoinAddress();
        await page
            .locator("input[data-testid='onchainAddress']")
            .fill(btcAddress);

        await fillReceiveAmount(page, "0.001");
        await clickCreateSwap(page);
        await downloadAndVerifyRescueFile(page, rescueFileName);
        await waitForSwapCreated(page);

        await page.getByRole("button", { name: "Send" }).click();
        await waitForLockupConfirmed(page, "RBTC", "BTC");
        await clearBrowserStorage(page);

        await generateAnvilBlock(360);

        await navigateToRskRescue(page);
        await connectWallet(page, walletClient, { waitForAddress: false });
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
        await selectAndClickSwapItem(page, "Refund");

        const refundButton = page.getByRole("button", {
            name: dict.en.refund,
        });
        await expect(refundButton).toBeVisible();
        await refundButton.click();

        await expect(page.getByText(dict.en.refunded)).toBeVisible();
    });
});
