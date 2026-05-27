import { type Page, expect, test } from "@playwright/test";
import { SwapType } from "boltz-swaps/types";
import fs from "fs";
import path from "path";

import { type AssetType, BTC, LBTC, LUSDT } from "../../src/consts/Assets";
import dict from "../../src/i18n/i18n";
import {
    backupRescueFile,
    bitcoinSendToAddress,
    checkBoltzConfPatch,
    createAndVerifySwap,
    decodeLiquidRawTransaction,
    elementsSendToAddress,
    generateBitcoinBlock,
    generateBitcoinBlocks,
    generateInvoiceLnd,
    generateLiquidBlock,
    generateLiquidBlocks,
    getBitcoinAddress,
    getBitcoinBlockHeight,
    getCurrentSwapId,
    getLiquidAddress,
    getLiquidBlockHeight,
    getStoredSwap,
    mockSideSwapQuotes,
    setFailedToPay,
    waitForBlockHeight,
    waitForNodesToSync,
    waitForUTXOs,
} from "../utils";

const fileName = "rescue.json";

const navigateToSwapRescue = async (page: Page, swapId: string) => {
    await page.getByRole("link", { name: "Rescue" }).click();
    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);
    await expect(page.getByTestId("loading-spinner")).not.toBeVisible({
        timeout: 15_000,
    });
    await expect(swapItem.getByText("Refund")).toBeVisible();
    await swapItem.click();
};

const setChainSwap = async (page: Page, sendAsset: string) => {
    await page.locator("div[class='asset asset-LN'] div").click();
    await page.getByTestId("select-BTC").click();
    await page.locator("div[class='asset asset-LN'] div").last().click();
    await page.getByTestId("select-L-BTC").click();
    const receiveAmount = "0.01";
    const inputReceiveAmount = page.locator(
        "input[data-testid='receiveAmount']",
    );
    await inputReceiveAmount.fill(receiveAmount);
    const inputOnchainAddress = page.locator(
        "input[data-testid='onchainAddress']",
    );
    await inputOnchainAddress.fill(
        sendAsset === BTC
            ? await getLiquidAddress()
            : await getBitcoinAddress(),
    );
};

const setSubmarineSwap = async (page: Page, sendAsset: string) => {
    await page.locator("div[class='asset asset-BTC'] div").click();
    await page.getByTestId(`select-${sendAsset}`).click();
    await page.locator("#flip-assets").click();
    const receiveAmount = "0.01";
    const inputReceiveAmount = page.locator(
        "input[data-testid='receiveAmount']",
    );
    await inputReceiveAmount.fill(receiveAmount);
    const invoiceInput = page.locator("input[data-testid='invoice']");
    const invoice = await generateInvoiceLnd(1000000);
    await invoiceInput.fill(invoice);
};

const validateRefundTxInputs = async (page: Page, expectedInputs: number) => {
    const refundRequest = await page.waitForRequest((req) =>
        req.url().includes("/refund"),
    );
    const broadcastedTx = JSON.parse(refundRequest.postData() || "{}");

    const decodedTx = await decodeLiquidRawTransaction(
        broadcastedTx.transaction,
    );
    const tx = JSON.parse(decodedTx);

    expect(tx.vin.length).toBe(expectedInputs);
};

const createSwapAndGetDetails = async (
    page: Page,
    swapType: SwapType,
    asset: string,
) => {
    if (swapType === SwapType.Chain) {
        await setChainSwap(page, asset);
    } else {
        await setSubmarineSwap(page, asset);
    }

    const buttonCreateSwap = page.locator(
        "button[data-testid='create-swap-button']",
    );
    await expect(buttonCreateSwap).toBeEnabled();
    await buttonCreateSwap.click();
};

const getAddressAndAmount = async (page: Page) => {
    await page.locator("p[data-testid='copy-box']").click();
    const address = await page.evaluate(() => {
        return navigator.clipboard.readText();
    });
    expect(address).toBeDefined();

    await page.getByTestId("pay-onchain-buttons").getByText("amount").click();

    const sendAmount = await page.evaluate(() => {
        return navigator.clipboard.readText();
    });

    return { address, sendAmount };
};

const performBitcoinInitialPayment = async (
    address: string,
    sendAmount: string,
) => {
    await bitcoinSendToAddress(address, sendAmount);
    await generateBitcoinBlock();
    await waitForNodesToSync();
};

const performLiquidInitialPayment = async (
    address: string,
    sendAmount: string,
) => {
    await elementsSendToAddress(address, sendAmount);
    await generateLiquidBlock();
    await waitForNodesToSync();
};

export const performBitcoinExpiredSwapSetup = async (
    swapType: SwapType,
    sendAsset: string,
    address: string,
    sendAmount: string,
) => {
    await bitcoinSendToAddress(address, sendAmount);
    await bitcoinSendToAddress(address, sendAmount);
    await waitForUTXOs(sendAsset as AssetType, address, 2);
    const currentHeight = await getBitcoinBlockHeight();
    if (swapType === SwapType.Chain) {
        const blocks = 26;
        await generateBitcoinBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    } else {
        const blocks = 120;
        await generateBitcoinBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    }
    await waitForUTXOs(sendAsset as AssetType, address, 2);
};

const performLiquidExpiredSwapSetup = async (
    swapType: SwapType,
    sendAsset: string,
    address: string,
    sendAmount: string,
) => {
    await elementsSendToAddress(address, sendAmount);
    await elementsSendToAddress(address, sendAmount);
    await waitForUTXOs(sendAsset as AssetType, address, 2);
    const currentHeight = await getLiquidBlockHeight();
    if (swapType === SwapType.Chain) {
        const blocks = 269;
        await generateLiquidBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    } else {
        const blocks = 1200;
        await generateLiquidBlocks(blocks);
        await waitForNodesToSync();
        await waitForBlockHeight(sendAsset, currentHeight + blocks);
    }
    await waitForUTXOs(sendAsset as AssetType, address, 2);
};

const executeRefund = async (
    page: Page,
    asset: string,
    swapId: string,
    isExternalRescue = false,
) => {
    if (isExternalRescue) {
        await page.getByRole("link", { name: "Rescue" }).click();
        await page
            .getByRole("button", { name: "Rescue external swap" })
            .click();
        await page.getByTestId("refundUpload").setInputFiles(fileName);
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
    } else {
        await page.getByRole("link", { name: "Rescue" }).click();
        await expect(page.getByTestId("loading-spinner")).not.toBeVisible({
            timeout: 15_000,
        });
    }

    const swapItem = page.locator(`div[data-testid='swaplist-item-${swapId}']`);
    await expect(swapItem).toBeVisible();
    await swapItem.click();

    const refundInput = page.locator("input[data-testid='refundAddress']");
    await expect(refundInput).toBeVisible();
    await refundInput.fill(
        asset === BTC ? await getBitcoinAddress() : await getLiquidAddress(),
    );

    const refundButton = page.locator("button[data-testid='refundButton']");
    await expect(refundButton).toBeEnabled();
    await refundButton.click();
};

const validateRefundTransaction = async (
    page: Page,
    sendAsset: string,
    address: string,
) => {
    const refundTxLink = page.getByText("open refund transaction");
    const txId = (await refundTxLink.getAttribute("href"))!.split("/").pop();

    expect(txId).toBeDefined();
    await waitForUTXOs(sendAsset as AssetType, address, 0); // check that all UTXOs were refunded
};

test.describe("Refund", () => {
    const refundFileJson = path.join(__dirname, fileName);

    test.beforeEach(async ({ page }) => {
        await generateLiquidBlock();
        await page.route("**/utxo", (route) => route.continue()); // disabling HTTP caching for UTXOs
    });

    test.afterEach(() => {
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
    });

    test("Rescues L-BTC stuck at SideSwap intermediary Liquid address via external rescue", async ({
        page,
    }, testInfo) => {
        test.setTimeout(90_000);

        const rescueFileName = testInfo.outputPath("sideswap-rescue.json");
        await mockSideSwapQuotes(page);

        const userLiquidAddress = await getLiquidAddress();
        await page.goto(
            `/swap?sendAsset=${BTC}&receiveAsset=${LUSDT}&destination=${encodeURIComponent(
                userLiquidAddress,
            )}&receiveAmount=100000`,
        );

        const createButton = page.getByTestId("create-swap-button");
        await expect(createButton).toBeEnabled();
        await createButton.click();

        await expect(
            page.getByRole("button", { name: dict.en.download_new_key }),
        ).toBeVisible();
        const swapId = getCurrentSwapId(page);
        await backupRescueFile(page, rescueFileName);

        const storedSwap = await getStoredSwap<{
            sideswap?: {
                tempAddress?: string;
            };
        }>(page, swapId);
        const tempAddress = storedSwap.sideswap?.tempAddress;
        expect(tempAddress).toBeTruthy();

        await elementsSendToAddress(tempAddress!, "0.001");
        await generateLiquidBlock();
        await waitForUTXOs(LBTC, tempAddress!, 1);

        await page.evaluate(() => {
            window.localStorage.clear();
            indexedDB.deleteDatabase("swaps");
        });
        await page.reload();

        await page.goto("/rescue/external");
        await page.getByTestId("refundUpload").setInputFiles(rescueFileName);
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();

        const swapItem = page.locator(
            `div[data-testid='swaplist-item-${swapId}']`,
        );
        await expect(
            swapItem.getByRole("link", {
                name: dict.en.refund,
                exact: true,
            }),
        ).toBeVisible({ timeout: 30_000 });
        await swapItem.click();

        await expect(page.getByText(dict.en.sideswap_failed)).toBeVisible({
            timeout: 30_000,
        });

        const sweepAddress = await getLiquidAddress();
        await page.locator(".sideswap-recovery input").fill(sweepAddress);
        await page
            .locator(".sideswap-recovery")
            .getByRole("button", { name: dict.en.refund })
            .click();

        await expect(
            page.getByRole("heading", { name: dict.en.refunded }),
        ).toBeVisible({ timeout: 30_000 });
        await expect(
            page.locator(".sideswap-recovery").getByText(/Transaction:/),
        ).toHaveCount(0);
        await expect(
            page.locator(".sideswap-recovery").getByRole("link", {
                name: dict.en.blockexplorer.replace(
                    "{{ typeLabel }}",
                    dict.en.blockexplorer_refund_tx,
                ),
            }),
        ).toBeVisible();
        await waitForUTXOs(LBTC, tempAddress!, 0);
    });

    const setupSwapWithMultipleUTXOs = async (
        page: Page,
        amount: number,
        utxoCount: number,
    ) => {
        await createAndVerifySwap(page, refundFileJson);

        const swapId = getCurrentSwapId(page);
        const address = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });

        for (let i = 0; i < utxoCount; i++) {
            await elementsSendToAddress(address, amount);
        }

        await waitForUTXOs(LBTC, address, utxoCount);

        return { swapId, address };
    };

    const performRefundAction = async (page: Page, statusText: string) => {
        await expect(page.getByText(statusText)).toBeVisible();
        await page.getByTestId("refundAddress").fill(await getLiquidAddress());
        await page.getByTestId("refundButton").click();
    };

    test("Refunds all UTXOs of `invoice.failedToPay` via swap page", async ({
        page,
    }) => {
        const utxoCount = 3;
        const amount = 0.005;
        const statusText = "invoice.failedToPay";

        const { swapId, address } = await setupSwapWithMultipleUTXOs(
            page,
            amount,
            utxoCount,
        );

        await setFailedToPay(swapId);

        await performRefundAction(page, statusText);

        await validateRefundTxInputs(page, utxoCount);
        await validateRefundTransaction(page, LBTC, address);
    });

    test("Refunds all UTXOs of `invoice.failedToPay` via Rescue", async ({
        page,
    }) => {
        const utxoCount = 3;
        const amount = 0.005;
        const statusText = "invoice.failedToPay";

        const { swapId, address } = await setupSwapWithMultipleUTXOs(
            page,
            amount,
            utxoCount,
        );

        await setFailedToPay(swapId);

        await navigateToSwapRescue(page, swapId);
        await performRefundAction(page, statusText);
        await validateRefundTxInputs(page, utxoCount);
        await validateRefundTransaction(page, LBTC, address);
    });

    test("Refunds all UTXOs of `transaction.lockupFailed` via swap page", async ({
        page,
    }) => {
        const utxoCount = 3;
        const amount = 0.01;
        const statusText = "transaction.lockupFailed";

        const { address } = await setupSwapWithMultipleUTXOs(
            page,
            amount,
            utxoCount,
        );

        await page.reload();

        await performRefundAction(page, statusText);

        await validateRefundTxInputs(page, utxoCount);
        await validateRefundTransaction(page, LBTC, address);
    });

    test("Refunds all UTXOs of `transaction.lockupFailed` via Rescue", async ({
        page,
    }) => {
        const utxoCount = 3;
        const amount = 0.01;
        const statusText = "transaction.lockupFailed";

        const { swapId, address } = await setupSwapWithMultipleUTXOs(
            page,
            amount,
            utxoCount,
        );

        await navigateToSwapRescue(page, swapId);

        await performRefundAction(page, statusText);

        await validateRefundTxInputs(page, utxoCount);
        await validateRefundTransaction(page, LBTC, address);
    });

    [
        {
            sendAsset: BTC,
            type: SwapType.Submarine,
            paymentAmount: "0.00001",
            paymentType: "underpayment",
            viaRescue: false,
        },
        {
            sendAsset: BTC,
            type: SwapType.Submarine,
            paymentAmount: "1",
            paymentType: "overpayment",
            viaRescue: true,
        },
        {
            sendAsset: BTC,
            type: SwapType.Chain,
            paymentAmount: "0.00001",
            paymentType: "underpayment",
            viaRescue: false,
        },
        {
            sendAsset: BTC,
            type: SwapType.Chain,
            paymentAmount: "1",
            paymentType: "overpayment",
            viaRescue: true,
        },
        {
            sendAsset: LBTC,
            type: SwapType.Submarine,
            paymentAmount: "0.00001",
            paymentType: "underpayment",
            viaRescue: false,
        },
        {
            sendAsset: LBTC,
            type: SwapType.Submarine,
            paymentAmount: "1",
            paymentType: "overpayment",
            viaRescue: true,
        },
        {
            sendAsset: LBTC,
            type: SwapType.Chain,
            paymentAmount: "0.00001",
            paymentType: "underpayment",
            viaRescue: false,
        },
        {
            sendAsset: LBTC,
            type: SwapType.Chain,
            paymentAmount: "1",
            paymentType: "overpayment",
            viaRescue: true,
        },
    ].forEach(({ sendAsset, type, paymentAmount, paymentType, viaRescue }) => {
        test(`Refund transaction.lockupFailed due to ${paymentType} for ${sendAsset} ${type} swap${viaRescue ? " via Rescue" : ""}`, async ({
            page,
        }) => {
            await page.goto("/");

            await createSwapAndGetDetails(page, type, sendAsset);
            await backupRescueFile(page, fileName);

            const { address } = await getAddressAndAmount(page);
            const swapId = viaRescue ? getCurrentSwapId(page) : undefined;

            const sendPayment =
                sendAsset === BTC
                    ? bitcoinSendToAddress
                    : elementsSendToAddress;
            await sendPayment(address, paymentAmount);

            const generateBlock =
                sendAsset === BTC ? generateBitcoinBlock : generateLiquidBlock;
            await generateBlock();
            await waitForNodesToSync();

            await expect(
                page.getByText("transaction.lockupFailed"),
            ).toBeVisible({
                timeout: 15_000,
            });

            await waitForUTXOs(sendAsset as AssetType, address, 1);

            if (viaRescue && swapId !== undefined) {
                await navigateToSwapRescue(page, swapId);
            }

            const refundAddress =
                sendAsset === BTC
                    ? await getBitcoinAddress()
                    : await getLiquidAddress();
            await page.getByTestId("refundAddress").fill(refundAddress);
            await page.getByTestId("refundButton").click();

            await validateRefundTransaction(page, sendAsset, address);
        });
    });

    [
        { sendAsset: BTC, type: SwapType.Chain, external: false },
        { sendAsset: BTC, type: SwapType.Submarine, external: false },
        { sendAsset: BTC, type: SwapType.Chain, external: true },
        { sendAsset: BTC, type: SwapType.Submarine, external: true },
        { sendAsset: LBTC, type: SwapType.Chain, external: false },
        { sendAsset: LBTC, type: SwapType.Submarine, external: false },
        { sendAsset: LBTC, type: SwapType.Chain, external: true },
        { sendAsset: LBTC, type: SwapType.Submarine, external: true },
    ].forEach((swap) => {
        test(`Uncooperative refund expired ${swap.sendAsset} ${swap.type} swap via ${swap.external ? "External Rescue" : "Rescue"}`, async ({
            page,
        }) => {
            checkBoltzConfPatch();

            test.setTimeout(60_000); // leave enough time for block generation
            await page.goto("/");

            await createSwapAndGetDetails(page, swap.type, swap.sendAsset);
            await backupRescueFile(page, fileName);

            const { address, sendAmount } = await getAddressAndAmount(page);
            const performInitialPayment =
                swap.sendAsset === BTC
                    ? performBitcoinInitialPayment
                    : performLiquidInitialPayment;
            await performInitialPayment(address, sendAmount);

            await expect(
                page.locator("div[data-status='transaction.claimed']"),
            ).toBeVisible({ timeout: 30_000 });

            await waitForUTXOs(swap.sendAsset as AssetType, address, 0);

            const swapId = getCurrentSwapId(page);

            if (swap.external) {
                await page.evaluate(() => window.localStorage.clear());
                await page.reload();
            }

            const performExpiredSwapSetup =
                swap.sendAsset === BTC
                    ? performBitcoinExpiredSwapSetup
                    : performLiquidExpiredSwapSetup;
            await performExpiredSwapSetup(
                swap.type,
                swap.sendAsset,
                address,
                sendAmount,
            );
            await page.reload();
            await executeRefund(page, swap.sendAsset, swapId, swap.external);
            await validateRefundTransaction(page, swap.sendAsset, address);
        });
    });

    [
        { swapType: SwapType.Submarine, name: "submarine" },
        { swapType: SwapType.Chain, name: "chain" },
    ].forEach(({ swapType, name }) => {
        test(`Shows refund timeout ETA for LBTC ${name} swap on reload`, async ({
            page,
        }) => {
            test.setTimeout(45_000);
            await page.goto("/");

            await createSwapAndGetDetails(page, swapType, LBTC);
            await backupRescueFile(page, fileName);

            const { address, sendAmount } = await getAddressAndAmount(page);
            await performLiquidInitialPayment(address, sendAmount);

            await expect(
                page.locator("div[data-status='transaction.claimed']"),
            ).toBeVisible({ timeout: 5_000 });
            await waitForUTXOs(LBTC, address, 0);
            await elementsSendToAddress(address, sendAmount);
            await elementsSendToAddress(address, sendAmount);
            await waitForUTXOs(LBTC, address, 2);
            await generateLiquidBlock();
            await page.reload();
            await expect(
                page.locator("div[data-status='swap.waitingForRefund']"),
            ).toBeVisible({ timeout: 5_000 });
        });
    });
});
