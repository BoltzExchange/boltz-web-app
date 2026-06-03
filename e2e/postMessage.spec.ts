import { expect, test } from "@playwright/test";

import {
    generateBitcoinBlock,
    getBitcoinAddress,
    payInvoiceLnd,
    waitForNodesToSync,
} from "./utils";

test.describe("postMessage parent notification", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await waitForNodesToSync();
    });

    test("notifies parent window when reverse swap reaches final status", async ({
        page,
    }) => {
        test.setTimeout(180_000);

        const baseUrl = process.env.CI
            ? "http://localhost:4173"
            : "http://localhost:5173";

        await page.route(`${baseUrl}/e2e-parent-test`, async (route) => {
            await route.fulfill({
                contentType: "text/html",
                body: `<!DOCTYPE html>
<html>
<head><title>Parent Test Page</title></head>
<body>
  <iframe id="boltz-iframe" src="${baseUrl}/?embedded=true&parentOrigin=${baseUrl}" style="width:100%;height:100vh;border:none;"></iframe>
  <script>
    window.receivedMessages = [];
    window.addEventListener('message', function(event) {
      if (event.origin === '${baseUrl}') {
        window.receivedMessages.push(event.data);
      }
    });
  </script>
</body>
</html>`,
            });
        });

        await page.goto(`${baseUrl}/e2e-parent-test`);

        const iframe = page.frameLocator("#boltz-iframe");

        await page.waitForTimeout(2000);

        const receiveAmount = "0.01";
        const inputReceiveAmount = iframe.locator(
            "input[data-testid='receiveAmount']",
        );
        await inputReceiveAmount.fill(receiveAmount);

        const inputSendAmount = iframe.locator(
            "input[data-testid='sendAmount']",
        );
        await expect(inputSendAmount).not.toHaveValue("");

        const inputOnchainAddress = iframe.locator(
            "input[data-testid='onchainAddress']",
        );
        await inputOnchainAddress.fill(await getBitcoinAddress());

        const buttonCreateSwap = iframe.locator(
            "button[data-testid='create-swap-button']",
        );
        await expect(buttonCreateSwap).toBeEnabled();
        await buttonCreateSwap.click();

        const payInvoiceTitle = iframe.locator(
            "h2[data-testid='pay-invoice-title']",
        );
        await expect(payInvoiceTitle).toBeVisible({ timeout: 60_000 });

        const spanLightningInvoice = iframe.locator("span[class='btn']");
        await spanLightningInvoice.click();

        const iframeElement = await page
            .locator("#boltz-iframe")
            .elementHandle();
        const frame = await iframeElement!.contentFrame();
        const lightningInvoice = await frame!.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(lightningInvoice).toBeDefined();

        await payInvoiceLnd(lightningInvoice);

        await expect
            .poll(
                async () => {
                    return await page.evaluate<
                        Array<{
                            type: string;
                            status: string;
                        }>
                    >(() => {
                        const w = window as unknown as {
                            receivedMessages: Array<{
                                type: string;
                                status: string;
                            }>;
                        };
                        return w.receivedMessages.filter(
                            (m) =>
                                m.type === "boltz-swap-status" &&
                                (m.status === "invoice.settled" ||
                                    m.status === "transaction.claimed"),
                        );
                    });
                },
                { timeout: 60_000 },
            )
            .toHaveLength(1);
    });
});
