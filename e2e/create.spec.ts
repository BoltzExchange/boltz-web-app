import { expect, test } from "@playwright/test";
import BigNumber from "bignumber.js";

import { BTC, LBTC } from "../src/consts/Assets";
import { Denomination } from "../src/consts/Enums";
import { formatAmount } from "../src/utils/denomination";
import {
    generateInvoiceLnd,
    getBitcoinAddress,
    getBolt12Offer,
    getLiquidAddress,
} from "./utils";

test.describe("BIP21 URIs", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    [
        {
            description: "Bitcoin address input with amount",
            bip21Uri: (addr: string) => `bitcoin:${addr}?amount=0.001`,
            expectedSatAmount: 100_000,
            expectedAsset: BTC,
        },
        {
            description: "Bitcoin address input without amount",
            bip21Uri: (addr: string) =>
                `bitcoin:${addr}?label=Test%20Payment&message=For%20testing`,
            expectedAsset: BTC,
        },
        {
            description: "Liquid URI with uppercase prefix",
            bip21Uri: (addr: string) => `LIQUIDNETWORK:${addr}?amount=0.00025`,
            expectedSatAmount: 25_000,
            expectedAsset: LBTC,
        },
    ].forEach((condition) => {
        test(`${condition.description}`, async ({ page }) => {
            await page
                .locator(
                    "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
                )
                .click();
            await page.getByTestId("select-LN").click();

            const address =
                condition.expectedAsset === BTC
                    ? await getBitcoinAddress()
                    : await getLiquidAddress();

            const bip21Uri = condition.bip21Uri(address);
            const invoiceInput = page.getByTestId("invoice");
            const addressInput = page.getByTestId("onchainAddress");
            await invoiceInput.fill(bip21Uri);

            await expect(addressInput).toHaveValue(address);

            if (condition.expectedSatAmount !== undefined) {
                const receiveAmount = page.getByTestId("receiveAmount");
                await expect(receiveAmount).toHaveValue(
                    formatAmount(
                        BigNumber(condition.expectedSatAmount),
                        Denomination.Sat,
                        ".",
                    ),
                );
            }

            const receiveAsset = page.getByTestId("asset-receive");
            await expect(receiveAsset).toContainClass(
                `asset-${condition.expectedAsset}`,
            );
        });
    });

    test("Prioritize lightning over address", async ({ page }) => {
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
            )
            .click();
        await page.getByTestId("select-LN").click();

        const address = await getBitcoinAddress();
        const invoiceAmount = 150_000;
        const invoice = await generateInvoiceLnd(invoiceAmount);
        const bip21Uri = `bitcoin:${address}?amount=0.002&lightning=${invoice}`;

        const divFlipAssets = page.locator("#flip-assets");
        await divFlipAssets.click();

        const addressInput = page.getByTestId("onchainAddress");
        await addressInput.fill(bip21Uri);

        const invoiceInput = page.getByTestId("invoice");
        await expect(invoiceInput).toHaveValue(invoice);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(invoiceAmount), Denomination.Sat, "."),
        );

        const receiveAsset = page.getByTestId("asset-receive");
        await expect(receiveAsset).toContainClass("asset-LN");
    });

    test("Embedded BOLT12 offer in invoice input", async ({ page }) => {
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
            )
            .click();
        await page.getByTestId("select-LN").click();

        const address = await getBitcoinAddress();
        const bolt12Offer = await getBolt12Offer();
        const bip21Uri = `bitcoin:${address}?amount=0.005&lno=${bolt12Offer}`;

        const invoiceInput = page.getByTestId("invoice");
        await invoiceInput.fill(bip21Uri);

        await expect(invoiceInput).toHaveValue(bolt12Offer);

        const receiveAsset = page.getByTestId("asset-receive");
        await expect(receiveAsset).toContainClass("asset-LN");
    });

    test("Lightning URI in invoice input", async ({ page }) => {
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
            )
            .click();
        await page.getByTestId("select-LN").click();
        const invoiceAmount = 75_000;
        const invoice = await generateInvoiceLnd(invoiceAmount);
        const bip21Uri = `lightning:${invoice}`;

        const invoiceInput = page.getByTestId("invoice");
        await invoiceInput.fill(bip21Uri);

        await expect(invoiceInput).toHaveValue(invoice);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(invoiceAmount), Denomination.Sat, "."),
        );

        const receiveAsset = page.getByTestId("asset-receive");
        await expect(receiveAsset).toContainClass("asset-LN");
    });

    test("URI with BOLT12 offer", async ({ page }) => {
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
            )
            .click();
        await page.getByTestId("select-LN").click();

        const bolt12Offer = await getBolt12Offer();
        const bip21Uri = `lightning:${bolt12Offer}`;

        const invoiceInput = page.getByTestId("invoice");
        await invoiceInput.fill(bip21Uri);

        await expect(invoiceInput).toHaveValue(bolt12Offer);

        const receiveAsset = page.getByTestId("asset-receive");
        await expect(receiveAsset).toContainClass("asset-LN");
    });

    test("Bitcoin URI in invoice input switches to address", async ({
        page,
    }) => {
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection",
            )
            .click();
        await page.getByTestId("select-LN").click();

        const address = await getBitcoinAddress();
        const bip21Uri = `bitcoin:${address}?amount=0.001`;
        const expectedSatAmount = 100_000;

        const invoiceInput = page.getByTestId("invoice");
        await invoiceInput.fill(bip21Uri);

        const addressInput = page.getByTestId("onchainAddress");
        await expect(addressInput).toHaveValue(address);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(expectedSatAmount), Denomination.Sat, "."),
        );

        const receiveAsset = page.getByTestId("asset-receive");
        await expect(receiveAsset).toContainClass("asset-BTC");
    });
});
