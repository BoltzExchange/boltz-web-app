import { expect, test } from "@playwright/test";

test.describe("Products Pages", () => {
    test("should navigate to sub-pages from Products cards", async ({
        page,
    }) => {
        await page.goto("/products");

        const productLinks = [
            { id: "btcpay", href: "/products/btcpay" },
            { id: "client", href: "/products/client" },
            { id: "pro", href: "/products/pro" },
        ];

        for (const product of productLinks) {
            await page.getByTestId(`product-card-${product.id}`).click();
            await expect(page).toHaveURL(product.href);
            await page.goBack();
            await page.waitForLoadState("domcontentloaded");
        }
    });

    test.describe("Visual Snapshots", () => {
        const pages = [
            {
                name: "Main Products",
                path: "/products",
                fileName: "products.png",
            },
            {
                name: "BTCPay Plugin",
                path: "/products/btcpay",
                fileName: "btcpay.png",
            },
            {
                name: "Client",
                path: "/products/client",
                fileName: "client.png",
            },
            { name: "Pro", path: "/products/pro", fileName: "pro.png" },
        ];

        for (const p of pages) {
            test(`${p.name} page should match snapshot`, async ({ page }) => {
                await page.goto(p.path);
                await page.waitForLoadState("networkidle");
                await expect(page).toHaveScreenshot(p.fileName, {
                    fullPage: true,
                    maxDiffPixelRatio: 0.01,
                });
            });
        }
    });
});
