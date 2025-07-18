import { expect, test } from "@playwright/test";
import BigNumber from "bignumber.js";

import { btcToSat, satToBtc } from "../../src/utils/denomination";
import {
    bitcoinSendToAddress,
    elementsGetReceivedByAddress,
    elementsSendToAddress,
    fetchBip21Invoice,
    generateBitcoinBlock,
    generateInvoiceWithRoutingHint,
    generateLiquidBlock,
    getBitcoinAddress,
    getBitcoinWalletTx,
    getLiquidAddress,
    verifyRescueFile,
} from "../utils";

test.describe("Chain swap", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
    });

    test("BTC/L-BTC", async ({ page }) => {
        await page.goto("/");

        const assetSelector = page.locator("div[class='asset asset-LN'] div");
        await assetSelector.click();

        const lbtcAsset = page.locator("div[data-testid='select-L-BTC']");
        await lbtcAsset.click();

        const receiveAmount = "0.01";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        const sendAmount = "0.01003057";
        await expect(inputSendAmount).toHaveValue(sendAmount);

        const inputOnchainAddress = page.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(await getBitcoinAddress());

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        await verifyRescueFile(page);

        const buttons = page.locator("div[data-testid='pay-onchain-buttons']");
        const copyAddressButton = buttons.getByText("address");
        expect(copyAddressButton).toBeDefined();
        await copyAddressButton.click();

        const sendAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(sendAddress).toBeDefined();

        await elementsSendToAddress(sendAddress, sendAmount);
        await generateLiquidBlock();

        const txIdLink = page.getByText("open claim transaction");

        const txId = (await txIdLink.getAttribute("href")).split("/").pop();
        expect(txId).toBeDefined();

        const txInfo = JSON.parse(await getBitcoinWalletTx(txId));
        expect(txInfo.amount.toString()).toEqual(receiveAmount);
    });

    test("BTC/LN with Magic Routing Hint switches to BTC/L-BTC", async ({
        page,
    }) => {
        await page.goto("/");

        const btcAsset = page.locator("div[class='asset asset-BTC'] div");
        await btcAsset.click();

        const lnAsset = page.locator("div[data-testid='select-LN']");
        await lnAsset.click();

        const receiveAmount = "0.0009";

        const inputInvoice = page.locator("textarea[data-testid='invoice']");
        const liquidAddress = await getLiquidAddress();
        const invoice = await generateInvoiceWithRoutingHint(
            liquidAddress,
            btcToSat(BigNumber(receiveAmount)).toNumber(),
        );
        await inputInvoice.fill(invoice);

        const bip21 = new URL((await fetchBip21Invoice(invoice)).bip21);
        const bip21Amount = BigNumber(bip21.searchParams.get("amount") ?? 0);

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        await verifyRescueFile(page);

        await expect(
            page.locator("div[data-status='swap.created']"),
        ).toBeVisible();

        await expect(
            page.locator("span[class='optimized-route']"),
        ).toBeVisible();

        await page.locator("p[data-testid='copy-box']").click();

        const copyAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(copyAddress).toBeDefined();

        await page
            .getByTestId("pay-onchain-buttons")
            .getByText("amount")
            .click();

        const sendAmount = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });

        await bitcoinSendToAddress(
            copyAddress,
            satToBtc(BigNumber(sendAmount)).toString(),
        );

        await generateBitcoinBlock();

        await expect(
            page.locator("div[data-status='transaction.claimed']"),
        ).toBeVisible({ timeout: 15_000 });

        // Recipient should receive original MRH invoice amount
        expect(await elementsGetReceivedByAddress(liquidAddress, 0)).toBe(
            bip21Amount.toNumber(),
        );
    });
});
