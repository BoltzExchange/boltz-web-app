import { expect, test } from "@playwright/test";

import { addReferral, getReferrals, setReferral } from "./utils";

const referral = "pro";

test.describe("Fees", () => {
    test("should show routing fees", async ({ page }) => {
        if (!(referral in (await getReferrals()))) {
            await addReferral(referral);
        }

        const config = { maxRoutingFee: 0.001 };
        await setReferral(referral, config);

        await page.goto(`/?ref=${referral}`);

        await page.locator(".arrow-down").first().click();
        await page.getByTestId("select-BTC").click();
        await page
            .locator(
                "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
            )
            .click();
        await page.getByTestId("select-LN").click();

        const routingFees = page.getByTestId("routing-fee-limit");
        await expect(routingFees).toHaveText(
            `${config.maxRoutingFee * 100 * 10_000} ppm`,
        );
    });
});
