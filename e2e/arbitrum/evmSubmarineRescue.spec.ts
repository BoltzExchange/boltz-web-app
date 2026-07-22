import type { Page } from "@playwright/test";
import { readFileSync } from "fs";
import { type Address, createWalletClient, http } from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { evmAccountFromPrivateKey } from "../../src/utils/rescueDerivation";
import {
    type RescueFile,
    deriveKeyGasAbstraction,
} from "../../src/utils/rescueFile";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    generateBitcoinBlock,
    generateInvoiceLnd,
    getCurrentSwapId,
    waitForNodesToSync,
} from "../utils";
import {
    actionTimeout,
    approveAndSend,
    clearBrowserStorage,
    connectWallet,
    createEthereumClient,
    deliverOft,
    describeArbitrumE2e,
    ethereumE2eChain,
    ethereumRpcUrl,
    expect,
    fullFlowTestTimeout,
    fundEthereumStablesE2eWallet,
    getStablesE2eWalletAddress,
    saveRescueFile,
    scanAndSelectExternalResult,
    selectAssets,
    test,
    waitForBridgeTxHash,
    waitForEthereumRpc,
    waitForLockupTxHash,
} from "./shared";

const createSwap = async (
    page: Page,
    rescueFilePath: string,
    walletAddress: Address,
) => {
    await page.goto("/swap");
    await selectAssets(page, "USDT0-ETH", "LN");
    await page.getByTestId("receiveAmount").fill("0.0002");
    await page.getByTestId("invoice").fill(await generateInvoiceLnd(20_000));
    await connectWallet(page, walletAddress);

    const button = page.getByTestId("create-swap-button");
    await expect(button).toBeEnabled({ timeout: actionTimeout });
    await button.click();
    await saveRescueFile(page, rescueFilePath);
    await expect(page.locator("div[data-status='invoice.set']")).toBeVisible({
        timeout: actionTimeout,
    });
    return getCurrentSwapId(page);
};

const getRescueAddress = (rescueFilePath: string): Address => {
    const rescueFile = JSON.parse(
        readFileSync(rescueFilePath, "utf8"),
    ) as RescueFile;
    const chainId = config.assets?.USDT0?.network?.chainId;
    if (chainId === undefined) {
        throw new Error("missing USDT0 chain id");
    }
    return evmAccountFromPrivateKey(
        deriveKeyGasAbstraction(rescueFile, chainId).privateKey,
    ).address;
};

describeArbitrumE2e("Submarine pair external rescue e2e", () => {
    test("shows the original submarine pair", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(fullFlowTestTimeout + actionTimeout * 2);
        await generateBitcoinBlock();
        await waitForNodesToSync();

        const ethereum = createEthereumClient();
        await waitForEthereumRpc(ethereum);
        const walletAddress = await getStablesE2eWalletAddress(ethereum);
        await fundEthereumStablesE2eWallet(ethereum, walletAddress);
        await injectWalletProvider({
            page,
            publicClient: ethereum,
            walletClient: createWalletClient({
                account: walletAddress,
                chain: ethereumE2eChain,
                transport: http(ethereumRpcUrl(), { timeout: actionTimeout }),
            }),
            chain: ethereumE2eChain,
        });
        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const swapId = await createSwap(page, rescueFilePath, walletAddress);
        await approveAndSend(page, walletAddress);
        const bridgeTxHash = await waitForBridgeTxHash(page, swapId);
        await deliverOft(
            ethereum,
            arbitrum.publicClient,
            bridgeTxHash,
            getRescueAddress(rescueFilePath),
            arbitrum.rpcUrl,
        );
        await waitForLockupTxHash(page, swapId);
        await clearBrowserStorage(page);
        await scanAndSelectExternalResult({
            page,
            swapId,
            rescueFilePath,
            action: dict.en.refund,
            assets: ["USDT", "LN"],
        });
    });
});
