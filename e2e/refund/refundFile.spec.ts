import { expect, test } from "@playwright/test";
import path from "path";

import dict from "../../src/i18n/i18n";

test.describe("Refund files", () => {
    test("should show when no lockup transaction can be found", async ({
        page,
    }) => {
        await page.goto("/");

        await page.getByRole("link", { name: "Refund" }).click();
        await page
            .getByRole("button", { name: "Refund external swap" })
            .click();
        await page.getByTestId("refundUpload").click();

        await page
            .getByTestId("refundUpload")
            .setInputFiles(path.join(__dirname, "noLockup.png"));

        await expect(
            page.getByRole("button", { name: dict.en.no_lockup_transaction }),
        ).toBeVisible();
    });
});
