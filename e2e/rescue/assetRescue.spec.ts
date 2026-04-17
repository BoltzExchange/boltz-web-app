import { type Page, expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

import { LBTC } from "../../src/consts/Assets";
import dict from "../../src/i18n/i18n";
import {
    createAndVerifySwap,
    execCommand,
    generateLiquidBlock,
    getLiquidAddress,
    waitForUTXOs,
} from "../utils";

test.describe("Asset Rescue", () => {
    const fileName = path.join(__dirname, "rescue.json");

    test.afterEach(() => {
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
    });

    const amountIssued = 1;
    const amountSent = 0.125;

    const sendWrongAsset = async (address: string): Promise<string> => {
        const { asset } = JSON.parse(
            await execCommand(
                `elements-cli-sim-client issueasset ${amountIssued} ${amountIssued}`,
            ),
        ) as { asset: string };
        await execCommand(
            `elements-cli-sim-client -named sendtoaddress address=${address} amount=${amountSent} assetlabel=${asset}`,
        );

        const balances = JSON.parse(
            await execCommand("elements-cli-sim-client getbalance"),
        );
        expect(balances[asset]).toEqual(amountIssued - amountSent);

        return asset;
    };

    const performRefund = async (page: Page, asset: string) => {
        const refundAddressInput = page.getByTestId("refundAddress");
        await expect(refundAddressInput).toBeVisible();
        await refundAddressInput.fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();

        await expect(page.getByText(dict.en.refunded)).toBeVisible();

        await generateLiquidBlock();

        const balances = JSON.parse(
            await execCommand("elements-cli-sim-client getbalance"),
        );
        expect(balances[asset]).toEqual(amountIssued);
    };

    const refundAssetToAddress = async (page: Page, address: string) => {
        const asset = await sendWrongAsset(address);
        await performRefund(page, asset);
    };

    const refundAsset = async (page: Page) => {
        const address = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        await refundAssetToAddress(page, address);
    };

    test("Refunds assets sent to submarine swap", async ({ page }) => {
        await createAndVerifySwap(page, fileName);

        await refundAsset(page);
    });

    test("Refunds assets sent to same submarine swap twice", async ({
        page,
    }) => {
        await createAndVerifySwap(page, fileName);

        const address = await page.evaluate(() =>
            navigator.clipboard.readText(),
        );

        await refundAssetToAddress(page, address);

        // Second rescue goes via the rescue-file route
        const asset = await sendWrongAsset(address);
        await waitForUTXOs(LBTC, address, 1);

        await page.getByRole("link", { name: "Rescue" }).click();
        await page
            .getByRole("button", { name: dict.en.rescue_external_swap })
            .click();
        await page.getByTestId("refundUpload").setInputFiles(fileName);
        await page.locator(".swaplist-item").first().click();

        await performRefund(page, asset);
    });

    test("Refunds assets sent to chain swap", async ({ page }) => {
        await page.goto("/");
        await page.locator(".arrow-down").first().click();
        await page.getByTestId("select-L-BTC").click();
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
            )
            .click();
        await page.getByTestId("select-BTC").click();

        await page
            .getByTestId("onchainAddress")
            .fill("bcrt1qkexe8knwmj80mcdlcsmx4m8t84a42nmszyw6dq");
        await page.getByTestId("create-swap-button").click();

        const downloadPromise = page.waitForEvent("download");
        await page
            .getByRole("button", { name: dict.en.download_new_key })
            .click();
        await (await downloadPromise).saveAs(fileName);

        await page.getByTestId("rescueFileUpload").setInputFiles(fileName);
        await page.getByTestId("copy_address").click();

        await refundAsset(page);
    });
});
