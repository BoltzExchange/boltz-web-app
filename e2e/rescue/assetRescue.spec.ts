import { type Page, expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

import dict from "../../src/i18n/i18n";
import {
    createAndVerifySwap,
    execCommand,
    generateLiquidBlock,
    getLiquidAddress,
} from "../utils";

test.describe("Asset Rescue", () => {
    const fileName = path.join(__dirname, "rescue.json");

    test.afterEach(() => {
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
    });

    const refundAsset = async (page: Page) => {
        const address = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });

        const amountIssued = 1;
        const { asset } = JSON.parse(
            await execCommand(
                `elements-cli-sim-client issueasset ${amountIssued} ${amountIssued}`,
            ),
        );
        const amountSent = 0.125;
        await execCommand(
            `elements-cli-sim-client -named sendtoaddress address=${address} amount=${amountSent} assetlabel=${asset}`,
        );

        let balances = JSON.parse(
            await execCommand("elements-cli-sim-client getbalance"),
        );
        expect(balances[asset]).toEqual(amountIssued - amountSent);

        await expect(page.getByText("transaction.lockupFailed")).toBeVisible();

        await page.getByTestId("refundAddress").fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();

        await generateLiquidBlock();

        balances = JSON.parse(
            await execCommand("elements-cli-sim-client getbalance"),
        );
        expect(balances[asset]).toEqual(amountIssued);
    };

    test("Refunds assets sent to submarine swap", async ({ page }) => {
        await createAndVerifySwap(page, fileName);

        await refundAsset(page);
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
