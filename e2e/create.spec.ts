import { type Page, expect, test } from "@playwright/test";
import BigNumber from "bignumber.js";
import fs from "fs";

import { BTC, LBTC, LN } from "../src/consts/Assets";
import { Denomination } from "../src/consts/Enums";
import dict from "../src/i18n/i18n";
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
                        BTC,
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
            formatAmount(BigNumber(invoiceAmount), Denomination.Sat, ".", BTC),
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
            formatAmount(BigNumber(invoiceAmount), Denomination.Sat, ".", BTC),
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
            formatAmount(BigNumber(expectedSatAmount), Denomination.Sat, ".", BTC),
        );

        const receiveAsset = page.getByTestId("asset-receive");
        await expect(receiveAsset).toContainClass("asset-BTC");
    });
});

const completeBackup = async (page: Page) => {
    const fileName = "rescue-file.json";
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: dict.en.download_new_key }).click();

    await (await downloadPromise).saveAs(fileName);
    await page.getByTestId("rescueFileUpload").setInputFiles(fileName);

    if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
    }
};

test.describe("page reload during backup: redirect to /swap after completion", () => {
    [
        {
            description: `${BTC} -> ${LN}`,
            url: async () => {
                const invoice = await generateInvoiceLnd(100000);
                return `/swap?sendAsset=${BTC}&receiveAsset=${LN}&destination=${invoice}`;
            },
        },
        {
            description: `${LBTC} -> ${BTC}`,
            url: async () => {
                const receiveAddress = await getBitcoinAddress();
                return `/swap?sendAsset=${LBTC}&receiveAsset=${BTC}&destination=${receiveAddress}&receiveAmount=100000`;
            },
        },
        {
            description: `${BTC} -> ${LN} with invoice`,
            url: async () => {
                const invoice = await generateInvoiceLnd(100000);
                return `/swap?sendAsset=${BTC}&receiveAsset=${LN}&destination=${invoice}&receiveAmount=100000`;
            },
        },
        {
            description: `${BTC} -> ${LN} with bolt12 offer`,
            url: async () => {
                const bolt12Offer = await getBolt12Offer();
                return `/swap?sendAsset=${BTC}&receiveAsset=${LN}&destination=${bolt12Offer}&receiveAmount=100000`;
            },
        },
    ].forEach(({ description, url }) => {
        test(`${description}`, async ({ page }) => {
            await page.goto(await url());

            const buttonCreateSwap = page.locator(
                "button[data-testid='create-swap-button']",
            );
            await expect(buttonCreateSwap).toBeEnabled();
            await buttonCreateSwap.click();

            await expect(
                page.getByRole("heading", {
                    name: dict.en.download_boltz_rescue_key,
                }),
            ).toBeVisible();

            await page.reload();

            await expect(
                page.getByRole("heading", {
                    name: dict.en.download_boltz_rescue_key,
                }),
            ).toBeVisible();

            await completeBackup(page);
            await expect(page).toHaveURL(/\/swap$/);
        });
    });
});
