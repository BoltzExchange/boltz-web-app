import { expect, test } from "@playwright/test";
import BigNumber from "bignumber.js";

import { btcToSat } from "../src/utils/denomination";
import {
    addReferral,
    bitcoinSendToAddress,
    generateBitcoinBlock,
    generateInvoiceLnd,
    generateInvoiceWithRoutingHint,
    getLiquidAddress,
    getReferrals,
    lookupInvoiceLnd,
    setReferral,
    verifyRescueFile,
    waitForNodesToSync,
} from "./utils";

test.describe("Submarine swap", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await waitForNodesToSync();
    });

    test("Submarine swap BTC/BTC", async ({ page }) => {
        await page.goto("/");

        const divFlipAssets = page.locator("#flip-assets");
        await divFlipAssets.click();

        const receiveAmount = "0.01";
        const inputReceiveAmount = page.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = page.locator("input[data-testid='sendAmount']");
        const sendAmount = "0.01001302";
        await expect(inputSendAmount).toHaveValue(sendAmount);

        const invoiceInput = page.locator("textarea[data-testid='invoice']");
        const invoice = await generateInvoiceLnd(1000000);
        await invoiceInput.fill(invoice);
        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        await verifyRescueFile(page);

        const copyAddressButton = page.getByTestId("copy_address");
        expect(copyAddressButton).toBeDefined();
        await copyAddressButton.click();

        const sendAddress = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(sendAddress).toBeDefined();
        await bitcoinSendToAddress(sendAddress, sendAmount);

        await generateBitcoinBlock();

        const validationLink = new URL(
            await page.getByText("Show Proof of Payment").getAttribute("href"),
        );

        expect(validationLink.searchParams.get("invoice")).toEqual(invoice);
        const preimage = validationLink.searchParams.get("preimage");

        const lookupRes = await lookupInvoiceLnd(invoice);
        expect(lookupRes.state).toEqual("SETTLED");
        expect(lookupRes.r_preimage).toEqual(preimage);
    });

    test("Create with LNURL", async ({ page }) => {
        await page.goto("/");

        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
            )
            .click();
        await page.getByTestId("select-LN").click();
        await page.locator(".asset-wrap").first().click();
        await page.getByTestId("select-L-BTC").click();

        await page.getByTestId("invoice").click();
        await page
            .getByTestId("invoice")
            .fill(
                "LNURL1DP68GUP69UHNZV3H9CCZUVPWXYARXVPSXQHKZURF9AKXUATJD3CQQKE2EU",
            );

        await page.getByTestId("sendAmount").fill("50 0000");

        await page.getByTestId("create-swap-button").click();
        // When we can click that button, the swap was created
        await verifyRescueFile(page);
    });

    test("BTC/LN with expensive MRH doesn't use MRH", async ({ page }) => {
        await page.goto("/?ref=expensive");

        if (!(await getReferrals())["expensive"]) {
            await addReferral("expensive");
        }

        // Make L-BTC/BTC chain swaps more expensive than submarine swap
        await setReferral("expensive", {
            pairs: {
                "L-BTC/BTC": { premiums: { "2": { "0": 100, "1": 100 } } },
            },
        });

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

        const buttonCreateSwap = page.locator(
            "button[data-testid='create-swap-button']",
        );
        await buttonCreateSwap.click();

        await verifyRescueFile(page);

        await expect(
            page.locator("div[data-status='invoice.set']"),
        ).toBeVisible();

        await expect(
            page.locator("span[class='optimized-route']"),
        ).not.toBeVisible();
    });
});
