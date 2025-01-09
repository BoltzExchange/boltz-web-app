import { expect, test } from "@playwright/test";

import dict from "../src/i18n/i18n";

test.describe("Locales", () => {
    [
        {
            locale: "en-GB",
            dict: dict.en,
        },
        {
            locale: "en-US",
            dict: dict.en,
        },
        {
            locale: "de-DE",
            dict: dict.de,
        },
        {
            locale: "es-ES",
            dict: dict.es,
        },
        {
            locale: "zh-Hans-CN",
            dict: dict.zh,
        },
        {
            locale: "ja-JP",
            dict: dict.ja,
        },
    ].forEach(({ locale, dict }) => {
        test(`Default language for locale ${locale}`, async ({ browser }) => {
            const context = await browser.newContext({
                locale,
            });
            const page = await context.newPage();

            await page.goto("/");
            await expect(page.getByTestId("create-swap-title")).toHaveText(
                dict.create_swap,
            );
        });
    });
});
