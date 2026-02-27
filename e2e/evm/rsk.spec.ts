import dict from "../../src/i18n/i18n";
import { expect, test } from "../fixtures/ethereum";
import {
    bitcoinSendToAddress,
    elementsSendToAddress,
    generateBitcoinBlock,
    generateInvoiceLnd,
    generateLiquidBlock,
    getBitcoinAddress,
    getLiquidAddress,
    payInvoiceLndBackground,
    verifyRescueFile,
} from "../utils";

test.describe("EVM", () => {
    test.beforeEach(async ({ injectProvider }) => {
        await injectProvider();
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("should connect wallet and display address", async ({
        page,
        walletClient,
    }) => {
        await page.goto("/");

        await page.locator("div[class='asset asset-LN'] div").click();
        await page.locator("div[data-testid='select-RBTC']").click();

        await page
            .getByRole("button", { name: dict.en.connect_wallet })
            .click();

        const modal = page.locator("[data-testid='wallet-connect-modal']");
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.getByText(/metamask/i).click();
        }

        const shortAddress = walletClient.account.address.slice(0, 8);
        await expect(page.locator(`text=${shortAddress}`)).toBeVisible({
            timeout: 10_000,
        });
    });

    // X -> RBTC swaps (user sends BTC/LBTC, receives RBTC)
    const toRbtcCases = [
        {
            send: "BTC",
            sendTestId: "select-BTC",
            sendToAddress: bitcoinSendToAddress,
            mineSendBlock: generateBitcoinBlock,
        },
        {
            send: "L-BTC",
            sendTestId: "select-L-BTC",
            sendToAddress: elementsSendToAddress,
            mineSendBlock: generateLiquidBlock,
        },
    ];

    toRbtcCases.forEach(
        ({ send, sendTestId, sendToAddress, mineSendBlock }) => {
            test(`${send} -> RBTC chain swap with claim`, async ({
                page,
                walletClient,
            }) => {
                await page.goto("/");

                // Select send asset
                const assetSelectors = page.locator(
                    "div[class^='asset asset-']",
                );
                await assetSelectors.first().click();
                await page.locator(`div[data-testid='${sendTestId}']`).click();

                // Select RBTC as receive asset
                await assetSelectors.last().click();
                await page.locator("div[data-testid='select-RBTC']").click();

                await page
                    .getByRole("button", {
                        name: dict.en.connect_wallet,
                        exact: true,
                    })
                    .click();

                const modal = page.locator(
                    "[data-testid='wallet-connect-modal']",
                );
                if (
                    await modal.isVisible({ timeout: 2000 }).catch(() => false)
                ) {
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

                const inputSendAmount = page.locator(
                    "input[data-testid='sendAmount']",
                );
                await expect(inputSendAmount).not.toHaveValue("");

                const sendAmount = await inputSendAmount.inputValue();

                const buttonCreateSwap = page.locator(
                    "button[data-testid='create-swap-button']",
                );
                await expect(buttonCreateSwap).toBeEnabled();
                await buttonCreateSwap.click();

                await verifyRescueFile(page);

                await expect(
                    page.locator("div[data-status='swap.created']"),
                ).toBeVisible();

                const copyAddressButton = page
                    .locator("div[data-testid='pay-onchain-buttons']")
                    .getByText("address");
                await copyAddressButton.click();

                const lockupAddress = await page.evaluate(() => {
                    return navigator.clipboard.readText();
                });
                expect(lockupAddress).toBeDefined();

                await sendToAddress(lockupAddress, sendAmount);
                await mineSendBlock();
                await page.waitForTimeout(500);

                await page.getByRole("button", { name: "Continue" }).click();

                const claimPending = page.locator(
                    "div[data-status='transaction.claim.pending']",
                );
                const claimConfirmed = page.locator(
                    "div[data-status='transaction.claimed']",
                );
                await expect(claimPending.or(claimConfirmed)).toBeVisible();
            });
        },
    );

    // RBTC -> X swaps (user sends RBTC, receives BTC/LBTC)
    const fromRbtcCases = [
        {
            receive: "BTC",
            receiveTestId: "select-BTC",
            getAddress: getBitcoinAddress,
            mineReceiveBlock: generateBitcoinBlock,
        },
        {
            receive: "L-BTC",
            receiveTestId: "select-L-BTC",
            getAddress: getLiquidAddress,
            mineReceiveBlock: generateLiquidBlock,
        },
    ];

    fromRbtcCases.forEach(
        ({ receive, receiveTestId, getAddress, mineReceiveBlock }) => {
            test(`RBTC -> ${receive} chain swap with claim`, async ({
                page,
                walletClient,
            }) => {
                await page.goto("/");

                const assetSelectors = page.locator(
                    "div[class^='asset asset-']",
                );

                // Select RBTC as send asset
                await assetSelectors.first().click();
                await page.locator("div[data-testid='select-RBTC']").click();

                // Select receive asset (BTC is default after RBTC, so only click if L-BTC)
                if (receiveTestId !== "select-BTC") {
                    await assetSelectors.last().click();
                    await page
                        .locator(`div[data-testid='${receiveTestId}']`)
                        .click();
                }

                await page
                    .getByRole("button", {
                        name: dict.en.connect_wallet,
                        exact: true,
                    })
                    .click();

                const modal = page.locator(
                    "[data-testid='wallet-connect-modal']",
                );
                if (
                    await modal.isVisible({ timeout: 2000 }).catch(() => false)
                ) {
                    await page.getByText(/metamask/i).click();
                }

                const shortAddress = walletClient.account.address.slice(0, 8);
                await expect(page.locator(`text=${shortAddress}`)).toBeVisible({
                    timeout: 10_000,
                });

                const receiveAddress = await getAddress();
                const inputOnchainAddress = page.locator(
                    "input[data-testid='onchainAddress']",
                );
                await inputOnchainAddress.fill(receiveAddress);

                const receiveAmount = "0.001";
                const inputReceiveAmount = page.locator(
                    "input[data-testid='receiveAmount']",
                );
                await inputReceiveAmount.fill(receiveAmount);

                const inputSendAmount = page.locator(
                    "input[data-testid='sendAmount']",
                );
                await expect(inputSendAmount).not.toHaveValue("");

                const buttonCreateSwap = page.locator(
                    "button[data-testid='create-swap-button']",
                );
                await expect(buttonCreateSwap).toBeEnabled({ timeout: 5000 });
                await buttonCreateSwap.click();

                await expect(
                    page.locator("div[data-status='swap.created']"),
                ).toBeVisible();

                await page.getByRole("button", { name: "Send" }).click();
                await page.waitForTimeout(500);
                await mineReceiveBlock();

                const claimPending = page.locator(
                    "div[data-status='transaction.claim.pending']",
                );
                const claimConfirmed = page.locator(
                    "div[data-status='transaction.claimed']",
                );
                await expect(claimPending.or(claimConfirmed)).toBeVisible();
            });
        },
    );

    test("LN -> RBTC reverse swap", async ({ page, walletClient }) => {
        await page.goto("/");

        const assetSelectors = page.locator("div[class^='asset asset-']");
        await assetSelectors.last().click();
        await page.locator("div[data-testid='select-RBTC']").click();

        await page
            .getByRole("button", { name: dict.en.connect_wallet, exact: true })
            .click();

        const modal = page.locator("[data-testid='wallet-connect-modal']");
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.getByText(/metamask/i).click();
        }

        const shortAddress = walletClient.account.address.slice(0, 8);
        await expect(page.locator(`text=${shortAddress}`)).toBeVisible({
            timeout: 10_000,
        });

        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill("0.001");

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        await expect(inputSendAmount).not.toHaveValue("");

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await expect(buttonCreateSwap).toBeEnabled();
        await buttonCreateSwap.click();

        const spanLightningInvoice = page.locator("span[class='btn']");
        await spanLightningInvoice.click();

        const lightningInvoice = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(lightningInvoice).toBeDefined();

        payInvoiceLndBackground(lightningInvoice);

        await page.waitForTimeout(500);

        const confirmed = page.locator(
            "div[data-status='transaction.confirmed']",
        );
        await expect(confirmed).toBeVisible();

        await page.getByRole("button", { name: "Continue" }).click();

        const settled = page.locator("div[data-status='invoice.settled']");
        await expect(settled).toBeVisible();
    });

    test("RBTC -> LN submarine swap", async ({ page, walletClient }) => {
        await page.goto("/");

        const assetSelectors = page.locator("div[class^='asset asset-']");
        await assetSelectors.first().click();
        await page.locator("div[data-testid='select-RBTC']").click();

        await assetSelectors.last().click();
        await page.locator("div[data-testid='select-LN']").click();

        await page
            .getByRole("button", { name: dict.en.connect_wallet, exact: true })
            .click();

        const modal = page.locator("[data-testid='wallet-connect-modal']");
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.getByText(/metamask/i).click();
        }

        const shortAddress = walletClient.account.address.slice(0, 8);
        await expect(page.locator(`text=${shortAddress}`)).toBeVisible({
            timeout: 10_000,
        });

        const invoice = await generateInvoiceLnd(100000);
        const invoiceInput = page.locator("textarea[data-testid='invoice']");
        await invoiceInput.fill(invoice);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        await expect(inputSendAmount).not.toHaveValue("");

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await expect(buttonCreateSwap).toBeEnabled();
        await buttonCreateSwap.click();

        await expect(
            page.locator("div[data-status='invoice.set']"),
        ).toBeVisible();

        await page.getByRole("button", { name: "Send" }).click();

        const settled = page.locator("div[data-status='invoice.settled']");
        const claimPending = page.locator(
            "div[data-status='transaction.claim.pending']",
        );
        await expect(settled.or(claimPending)).toBeVisible();
    });
});
