import type { Page } from "@playwright/test";
import { type Address, createWalletClient, http, parseUnits } from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { expect, test } from "../fixtures/arbitrum";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    generateBitcoinBlock,
    generateInvoiceLnd,
    getCurrentSwapId,
    lookupInvoiceLnd,
    verifyRescueFile,
    waitForNodesToSync,
} from "../utils";
import {
    actionTimeout,
    clickSendBridge,
    connectWallet,
    describeArbitrumE2e,
    expectArbitrumWalletReady,
    fullFlowTestTimeout,
    fundArbitrumStablesE2eWallet,
    getCodeFreeStablesE2eWalletAddress,
    getRegtestTokenAddress,
    probeTimeout,
    selectAssets,
    usdt0ArbitrumSendAmount,
    waitForDexQuote,
} from "./shared";

const hasCommitmentSubmarinePair = async (): Promise<boolean> => {
    const response = await fetch(`${config.apiUrl.normal}/v2/swap/submarine`);
    if (!response.ok) {
        return false;
    }

    const pairs = (await response.json()) as {
        TBTC?: { BTC?: unknown };
    };
    return pairs.TBTC?.BTC !== undefined;
};

const createCommitmentSwap = async (
    page: Page,
    walletAddress: Address,
): Promise<string> => {
    await page.goto("/swap");
    await selectAssets(page, "USDT0", "LN");
    await page.getByTestId("sendAmount").fill(usdt0ArbitrumSendAmount);

    await expect(page.getByTestId("committed-invoice-row")).toBeVisible({
        timeout: actionTimeout,
    });

    await connectWallet(page, walletAddress);

    const createButton = page.getByTestId("create-swap-button");
    await expect(createButton).toBeEnabled({ timeout: actionTimeout });
    await createButton.click();

    await expect(
        page
            .getByRole("button", { name: /^approve$/i })
            .or(page.getByRole("button", { name: /^send$/i })),
    ).toBeVisible({ timeout: actionTimeout });

    return getCurrentSwapId(page);
};

const copyCommitmentInvoiceSats = async (page: Page): Promise<number> => {
    const copyAmount = page.getByTestId("copy_amount");
    await expect(copyAmount).toBeVisible({ timeout: actionTimeout * 2 });
    await copyAmount.click();

    const rawAmount = await page.evaluate(() => navigator.clipboard.readText());
    const sats = Number(rawAmount.replace(/\D/g, ""));
    expect(Number.isSafeInteger(sats)).toBe(true);
    expect(sats).toBeGreaterThan(0);

    return sats;
};

describeArbitrumE2e("Arbitrum commitment swap e2e", () => {
    test.describe.configure({
        timeout: fullFlowTestTimeout + actionTimeout * 2,
    });

    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await waitForNodesToSync();
    });

    test("settles a USDT0-Arbitrum to LN commitment swap", async ({
        arbitrum,
        page,
    }) => {
        test.skip(
            !(await hasCommitmentSubmarinePair()),
            "default regtest does not expose the TBTC/BTC submarine pair required by commitment swaps",
        );

        const walletAddress = await getCodeFreeStablesE2eWalletAddress(
            arbitrum.publicClient,
        );
        const walletClient = createWalletClient({
            account: walletAddress,
            chain: arbitrum.chain,
            transport: http(arbitrum.rpcUrl, { timeout: actionTimeout }),
        });

        await fundArbitrumStablesE2eWallet(
            arbitrum.publicClient,
            walletAddress,
        );
        await expectArbitrumWalletReady(arbitrum.publicClient, walletAddress);
        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient,
            chain: arbitrum.chain,
        });

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("USDT0"),
            tokenOut: getRegtestTokenAddress("TBTC"),
            amountIn: parseUnits(usdt0ArbitrumSendAmount, 6),
            label: "USDT0 -> TBTC",
        });

        const commitmentId = await createCommitmentSwap(page, walletAddress);
        await clickSendBridge(page, walletAddress);

        const invoice = await generateInvoiceLnd(
            await copyCommitmentInvoiceSats(page),
        );
        await page.getByTestId("invoice").fill(invoice);
        const invoiceSubmitButton = page.getByTestId(
            "commitment-invoice-submit",
        );
        await expect(invoiceSubmitButton).toBeEnabled({
            timeout: actionTimeout,
        });
        await invoiceSubmitButton.click();

        await expect
            .poll(() => getCurrentSwapId(page), { timeout: actionTimeout })
            .not.toBe(commitmentId);
        const downloadButton = page.getByRole("button", {
            name: dict.en.download_new_key,
        });
        if (
            await downloadButton
                .isVisible({ timeout: probeTimeout })
                .catch(() => false)
        ) {
            await verifyRescueFile(page);
        }

        await expect(
            page
                .locator("div[data-status='transaction.claimed']")
                .or(page.locator("div[data-status='invoice.settled']")),
        ).toBeVisible({ timeout: fullFlowTestTimeout });

        expect((await lookupInvoiceLnd(invoice)).state).toEqual("SETTLED");
    });
});
