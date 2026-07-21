import { type Page, expect, test } from "@playwright/test";
import axios from "axios";
import BigNumber from "bignumber.js";

import { config } from "../../src/config";
import { satToBtc } from "../../src/utils/denomination";
import {
    elementsSendToAddress,
    expectApproxBtcAmount,
    generateBitcoinBlock,
    generateLiquidBlock,
    getBitcoinAddress,
    getBitcoinWalletTx,
    verifyRescueFile,
} from "../utils";

const quotePath = (swapId: string) => `/v2/swap/chain/${swapId}/quote`;

type ChainPairs = Record<
    string,
    Record<string, { fees: { minerFees: { user: { claim: number } } } }>
>;

const getLbtcBtcClaimFee = async (): Promise<number> => {
    const res = await axios.get<ChainPairs>(
        `${config.apiUrl!.normal}/v2/swap/chain`,
    );
    return res.data["L-BTC"]["BTC"].fees.minerFees.user.claim;
};

// Reads the swap straight from IndexedDB (localforage instance "swaps"),
// bypassing the app, to assert what survived the simulated crash.
const readPersistedSwap = (
    page: Page,
    swapId: string,
): Promise<{ receiveAmount: number; claimDetails: { amount: number } }> =>
    page.evaluate(async (id) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open("swaps");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return await new Promise((resolve, reject) => {
            const get = db
                .transaction("keyvaluepairs", "readonly")
                .objectStore("keyvaluepairs")
                .get(id);
            get.onsuccess = () => resolve(get.result);
            get.onerror = () => reject(get.error);
        });
    }, swapId);

test.describe("ChainSwap replacement quote acceptance crash", () => {
    test.beforeEach(async () => {
        await generateBitcoinBlock();
    });

    test("recovers the claim when the app dies right after the server accepts the quote", async ({
        page,
    }) => {
        test.setTimeout(120_000);

        await page.goto("/");

        // L-BTC -> BTC chain swap with a fixed receive amount
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
            .fill(await getBitcoinAddress());
        await page.getByTestId("receiveAmount").fill("100 000");
        await page.getByTestId("create-swap-button").click();
        await verifyRescueFile(page);

        const swapId = new URL(page.url()).pathname.split("/").pop()!;

        await page
            .getByTestId("pay-onchain-buttons")
            .getByText("address")
            .click();
        const lockupAddress = await page.evaluate(() =>
            navigator.clipboard.readText(),
        );

        // Overpay the lockup so the swap fails and a replacement quote is offered
        const quoteFetched = page.waitForResponse(
            (res) =>
                new URL(res.url()).pathname === quotePath(swapId) &&
                res.request().method() === "GET" &&
                res.ok(),
        );
        await elementsSendToAddress(lockupAddress, 0.01);
        const quoteAmount: number = (await (await quoteFetched).json()).amount;

        const claimFee = await getLbtcBtcClaimFee();
        const expectedReceive = quoteAmount - claimFee - 1;

        // Let the acceptance POST reach the backend, but never deliver the
        // response to the app: the crash window between the server accepting
        // the new quote and the client doing anything with that knowledge.
        let signalServerAccepted: (status: number) => void;
        const serverAccepted = new Promise<number>(
            (resolve) => (signalServerAccepted = resolve),
        );
        const quoteRoute = (url: URL) => url.pathname === quotePath(swapId);
        await page.route(quoteRoute, async (route) => {
            if (route.request().method() !== "POST") {
                return route.fallback();
            }
            const response = await route.fetch();
            signalServerAccepted(response.status());
            await route.abort("failed");
        });

        await page.getByRole("button", { name: "Accept" }).click();
        const acceptStatus = await serverAccepted;
        expect(acceptStatus).toBeGreaterThanOrEqual(200);
        expect(acceptStatus).toBeLessThan(300);

        // "Crash" and restart the app
        await page.reload();
        await page.unroute(quoteRoute);

        // The replacement quote must have been persisted before the server
        // could have accepted it; otherwise the claim below uses stale amounts
        const persisted = await readPersistedSwap(page, swapId);
        expect(persisted.claimDetails.amount).toBe(quoteAmount);
        expect(persisted.receiveAmount).toBe(expectedReceive);

        // Confirm the user lockup; the server proceeds with the accepted
        // quote and the restarted app must claim the replacement amount
        await generateLiquidBlock();

        const txIdLink = page.getByText("open claim transaction");
        await expect(txIdLink).toBeVisible({ timeout: 60_000 });
        const txId = (await txIdLink.getAttribute("href"))!.split("/").pop()!;

        const txInfo = JSON.parse(await getBitcoinWalletTx(txId));
        expectApproxBtcAmount(
            txInfo.amount.toString(),
            satToBtc(BigNumber(expectedReceive)).toString(),
        );
    });
});
