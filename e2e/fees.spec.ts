import { expect, test } from "@playwright/test";

import { addReferral, getReferrals, setReferral } from "./utils";

const referral = "boltz_webapp_desktop";

test.describe("Fees", () => {
    test("should show routing fees", async ({ page }) => {
        const referrals = await getReferrals();
        if (!referrals.some((r) => r.id === referral)) {
            await addReferral(referral);
        }

        const feeConfig = { maxRoutingFee: 0.001 };
        await setReferral(referral, feeConfig);

        await page.goto("/");

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
            `${feeConfig.maxRoutingFee * 100 * 10_000} ppm`,
        );
    });
});
