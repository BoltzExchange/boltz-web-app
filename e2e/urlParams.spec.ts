import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import BigNumber from "bignumber.js";

import { BTC, LBTC, LN, RBTC } from "../src/consts/Assets";
import { Denomination } from "../src/consts/Enums";
import { formatAmount } from "../src/utils/denomination";
import {
    generateInvoiceLnd,
    getBitcoinAddress,
    getLiquidAddress,
} from "./utils";

const toggleRescueModeOnClick = async (page: Page) => {
    const modeRescueKeyParam = /\?mode=rescue-key/;

    await page.getByTestId("enterMnemonicBtn").click();
    await expect(page.getByTestId("mnemonic-input-0")).toBeVisible();
    await expect(page).toHaveURL(modeRescueKeyParam);

    await page.getByTestId("backBtn").click();
    await expect(page.getByTestId("mnemonic-input-0")).not.toBeVisible();
    await expect(page).not.toHaveURL(modeRescueKeyParam);
};

test.describe("URL params", () => {
    test("BTC address destination", async ({ page }) => {
        const address = await getBitcoinAddress();

        await page.goto(`/?destination=${address}`);
        const receiveAsset = page.locator(".asset-BTC");
        expect(receiveAsset).toBeDefined();

        const onchainAddress = page.getByTestId("onchainAddress");
        await expect(onchainAddress).toHaveValue(address);
    });

    test("L-BTC address destination", async ({ page }) => {
        const address = await getLiquidAddress();

        await page.goto(`/?destination=${address}`);
        const receiveAsset = page.locator(".asset-L-BTC");
        expect(receiveAsset).toBeDefined();

        const onchainAddress = page.getByTestId("onchainAddress");
        await expect(onchainAddress).toHaveValue(address);
    });

    test("Lightning invoice destination", async ({ page }) => {
        const amount = 100_000;
        const invoice = await generateInvoiceLnd(amount);

        await page.goto(`/?destination=${invoice}`);
        const receiveAsset = page.locator(".asset-LN");
        expect(receiveAsset).toBeDefined();

        const invoiceInput = page.getByTestId("invoice");
        await expect(invoiceInput).toHaveValue(invoice);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(amount), Denomination.Sat, "."),
        );
    });

    test("should set send amount", async ({ page }) => {
        const amount = 210_000;
        await page.goto(`/?sendAmount=${amount}`);

        const sendAmount = page.getByTestId("sendAmount");
        await expect(sendAmount).toHaveValue(
            formatAmount(BigNumber(amount), Denomination.Sat, "."),
        );
    });

    test("should set receive amount", async ({ page }) => {
        const amount = 210_000;
        await page.goto(`/?receiveAmount=${amount}`);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(amount), Denomination.Sat, "."),
        );
    });

    test("should not set receive amount when send amount is set", async ({
        page,
    }) => {
        const sendAmount = 100_000;
        const receiveAmount = 210_000;
        await page.goto(
            `/?sendAmount=${sendAmount}&receiveAmount=${receiveAmount}`,
        );

        const sendAmountInput = page.getByTestId("sendAmount");
        await expect(sendAmountInput).toHaveValue(
            formatAmount(BigNumber(sendAmount), Denomination.Sat, "."),
        );
    });

    test("should not set amount when lightning invoice is set", async ({
        page,
    }) => {
        const invoiceAmount = 200_000;
        const invoice = await generateInvoiceLnd(invoiceAmount);

        const sendAmount = 100_000;

        await page.goto(`/?sendAmount=${sendAmount}&destination=${invoice}`);

        const receiveAmount = page.getByTestId("receiveAmount");
        await expect(receiveAmount).toHaveValue(
            formatAmount(BigNumber(invoiceAmount), Denomination.Sat, "."),
        );
    });

    test("should use `?mode=rescue-key` param to display mnemonic input", async ({
        page,
    }) => {
        const assertMnemonicVisible = async () => {
            await expect(page.getByTestId("mnemonic-input-0")).toBeVisible();
        };

        await page.goto("/");
        await page.getByRole("link", { name: "Refund" }).click();
        await page
            .getByRole("button", { name: "Refund External Swap" })
            .click();

        await toggleRescueModeOnClick(page);

        await page.goto("/backup/verify/existing");

        await toggleRescueModeOnClick(page);

        await page.goto("/refund/external?mode=rescue-key");
        await assertMnemonicVisible();

        await page.goto("/backup/verify/existing?mode=rescue-key");
        await assertMnemonicVisible();
    });

    const addressField = "onchainAddress";
    const invoiceField = "invoice";
    const invoiceAmount = 60_000;
    const invoice =
        "lnbcrt600u1p5x2wjrpp5wjcgtxdj54eagynhwj47wrj8mjnp8gl4yk9xym0e5qr8pp06rh2sdqqcqzzsxqrpwusp58cmvnphwn3w5kzz7nk9ptcxvq5v6xcq0ulhpvzrqemj3t2t0e7ws9qxpqysgq73kadzy3xytddq6e5znhqefkadj0y0hfytv96nj0fjra9vgwtruq5jd95kjl8w085mvzwm2nqx4dq7hee08vr7j3k63hzt2ctglvqgsqvtqxgp";
    const bitcoinAddress = "bcrt1qcewlsq7cy3dhs6hyd7aajj2jam6jxzfanp5648";
    const liquidAddress =
        "el1qqt9gjfexzshhw6nnxeaqt9ryjzafnqs56td9505cczv908433tzxgm7g275u5zwkpgla9lu3n7wqctl740xt2nl3wzr057xjj";
    [
        {
            description: "Invalid address destination",
            params: `?sendAsset=${LN}&receiveAsset=${BTC}&sendAmount=100000&destination=asdf`,
            expectedSendAsset: LN,
            expectedReceiveAsset: BTC,
            expectedSendAmount: 100000,
            expectedDestinationField: addressField,
            expectedDestinationValue: "asdf",
            expectedCreateButtonDisabled: true,
        },
        {
            description: "Invalid invoice destination",
            params: `?sendAsset=${BTC}&receiveAsset=${LN}&sendAmount=100000&destination=asdf`,
            expectedSendAsset: BTC,
            expectedReceiveAsset: LN,
            expectedDestinationField: invoiceField,
            expectedDestinationValue: "asdf",
            expectedCreateButtonDisabled: true,
        },
        {
            description: "Invalid assets (BTC > BTC)",
            params: `?sendAsset=${BTC}&receiveAsset=${BTC}&sendAmount=100000&destination=${bitcoinAddress}`,
            expectedSendAsset: BTC,
            expectedReceiveAsset: BTC,
            expectedSendAmount: 100000,
            expectedDestinationField: addressField,
            expectedDestinationValue: bitcoinAddress,
            expectedCreateButtonDisabled: true,
        },
        {
            description: "Invalid assets (LN > LN)",
            params: `?sendAmount=100000&destination=test@lnurl.com&sendAsset=${LN}`,
            expectedSendAsset: LN,
            expectedReceiveAsset: LN,
            expectedSendAmount: 100000,
            expectedDestinationField: invoiceField,
            expectedDestinationValue: "test@lnurl.com",
            expectedCreateButtonDisabled: true,
        },
        {
            description: "Bitcoin address destination",
            params: `?sendAmount=100000&destination=${bitcoinAddress}&sendAsset=${LBTC}`,
            expectedSendAsset: LBTC,
            expectedReceiveAsset: BTC,
            expectedSendAmount: 100000,
            expectedDestinationField: addressField,
            expectedDestinationValue: bitcoinAddress,
            expectedCreateButtonDisabled: false,
        },
        {
            description: "LNURL destination",
            params: `?destination=kilrau@getalby.com&sendAmount=2000&sendAsset=${LBTC}`,
            expectedSendAsset: LBTC,
            expectedReceiveAsset: LN,
            expectedSendAmount: 2000,
            expectedDestinationField: invoiceField,
            expectedDestinationValue: "kilrau@getalby.com",
            expectedCreateButtonDisabled: false,
        },
        {
            description: "Liquid address destination",
            params: `?sendAmount=100000&destination=${liquidAddress}&sendAsset=${LN}`,
            expectedSendAsset: LN,
            expectedReceiveAsset: LBTC,
            expectedSendAmount: 100000,
            expectedDestinationField: addressField,
            expectedDestinationValue: liquidAddress,
            expectedCreateButtonDisabled: false,
        },
        {
            description: "Lightning invoice destination",
            params: `?sendAmount=100000&destination=${invoice}&sendAsset=${BTC}`,
            expectedSendAsset: BTC,
            expectedReceiveAsset: LN,
            expectedReceiveAmount: invoiceAmount,
            expectedDestinationField: invoiceField,
            expectedDestinationValue: invoice,
            expectedCreateButtonDisabled: false,
        },
        {
            description: "RBTC destination",
            params: `?sendAmount=100000&receiveAsset=${RBTC}&sendAsset=${BTC}`,
            expectedReceiveAsset: RBTC,
            expectedSendAsset: BTC,
            expectedSendAmount: 100000,
        },
    ].forEach((condition) => {
        test(`Combined params ${condition.description}`, async ({ page }) => {
            await page.goto(`/${condition.params}`);

            if (condition.expectedSendAsset !== undefined) {
                const sendAsset = page.getByTestId(`asset-send`);
                await expect(sendAsset).toContainClass(
                    `asset-${condition.expectedSendAsset}`,
                );
            }

            if (condition.expectedReceiveAsset !== undefined) {
                const receiveAsset = page.getByTestId(`asset-receive`);
                await expect(receiveAsset).toContainClass(
                    `asset-${condition.expectedReceiveAsset}`,
                );
            }

            if (condition.expectedSendAmount !== undefined) {
                const sendAmountInput = page.getByTestId("sendAmount");
                await expect(sendAmountInput).toHaveValue(
                    formatAmount(
                        BigNumber(condition.expectedSendAmount),
                        Denomination.Sat,
                        ".",
                    ),
                );
            }

            if (condition.expectedReceiveAmount !== undefined) {
                const receiveAmountInput = page.getByTestId("receiveAmount");
                await expect(receiveAmountInput).toHaveValue(
                    formatAmount(
                        BigNumber(condition.expectedReceiveAmount),
                        Denomination.Sat,
                        ".",
                    ),
                );
            }

            if (condition.expectedDestinationField !== undefined) {
                const destinationField = page.getByTestId(
                    condition.expectedDestinationField,
                );
                expect(destinationField).toBeDefined();

                await expect(destinationField).toHaveValue(
                    condition.expectedDestinationValue,
                );
            }

            const createButton = page.getByTestId("create-swap-button");

            if (condition.expectedCreateButtonDisabled !== undefined) {
                if (condition.expectedCreateButtonDisabled) {
                    await expect(createButton).toBeDisabled();
                } else {
                    await expect(createButton).toBeEnabled();
                }
            }
        });
    });
});
