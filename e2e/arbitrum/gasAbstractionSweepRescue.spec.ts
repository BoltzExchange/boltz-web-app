import type { Locator, Page } from "@playwright/test";
import fs from "node:fs";
import { type Address, createWalletClient, http, parseUnits } from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { evmAccountFromPrivateKey } from "../../src/utils/rescueDerivation";
import {
    type RescueFile,
    deriveKeyGasAbstraction,
    generateRescueFile,
} from "../../src/utils/rescueFile";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    actionTimeout,
    arbitrumE2eChain,
    arbitrumRpcUrl,
    arbitrumStablesFundingSource,
    connectWallet,
    describeArbitrumE2e,
    expect,
    fundErc20FromWhale,
    getArbitrumWalletAddress,
    getRegtestTokenAddress,
    getTokenBalance,
    startExternalRescue,
    test,
    testTimeout,
} from "./shared";

// Deliberately distinct from the account indices used by the other Arbitrum specs.
const destinationWalletIndex = 7;
const strandedAmount = parseUnits("40", 6);

const deriveGasAbstractionAddress = (rescueFile: RescueFile): Address => {
    const chainId = config.assets?.USDT0?.network?.chainId;
    if (chainId === undefined) {
        throw new Error("missing USDT0 chainId");
    }

    return evmAccountFromPrivateKey(
        deriveKeyGasAbstraction(rescueFile, chainId).privateKey,
    ).address;
};

// Retry the upload + scan until the balance shows up; the scan never refetches on its own.
const scanForSweepableBalance = async (
    page: Page,
    rescueFilePath: string,
    sweepItem: Locator,
    // Omitted: the scan runs with only the rescue key
    walletAddress?: Address,
) => {
    await expect(async () => {
        await startExternalRescue(page);
        await page.getByTestId("refundUpload").setInputFiles(rescueFilePath);
        if (walletAddress !== undefined) {
            await connectWallet(page, walletAddress);
        }
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
        await expect(sweepItem).toBeVisible({ timeout: actionTimeout });
    }).toPass({
        timeout: actionTimeout * 2,
        intervals: [2_000, 5_000, 10_000],
    });
};

describeArbitrumE2e("Arbitrum gas abstraction sweep rescue e2e", () => {
    test("rescues stranded USDT0 found with only the rescue key", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(testTimeout);

        const rescueFile = generateRescueFile();
        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        fs.writeFileSync(rescueFilePath, JSON.stringify(rescueFile));

        const gasAbstractionAddress = deriveGasAbstractionAddress(rescueFile);
        const token = getRegtestTokenAddress("USDT0");

        // Strand USDT0 on the gas abstraction address, as if an OFT send had
        // completed without the subsequent TBTC lockup. No ETH on purpose: the
        // sweep has to be paid by the gas sponsor.
        await fundErc20FromWhale({
            publicClient: arbitrum.publicClient,
            chain: arbitrumE2eChain,
            rpcUrl: arbitrum.rpcUrl,
            token,
            whale: arbitrumStablesFundingSource,
            recipient: gasAbstractionAddress,
            amount: strandedAmount,
            gasRecipientAmount: 0n,
        });

        const sweepItem = page.getByTestId(
            `swaplist-item-sweep:USDT0:${gasAbstractionAddress}`,
        );

        // The stranded balance must be found without a connected wallet.
        await scanForSweepableBalance(page, rescueFilePath, sweepItem);
        await expect(
            sweepItem.getByRole("link", { name: dict.en.refund, exact: true }),
        ).toBeVisible();
        await expect(
            page.locator(".rescue-external-results .swaplist-item"),
        ).toHaveCount(1);

        // Executing the sweep needs a destination: connect a wallet and refund.
        const walletAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            destinationWalletIndex,
        );
        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient: createWalletClient({
                account: walletAddress,
                chain: arbitrumE2eChain,
                transport: http(arbitrumRpcUrl(), { timeout: actionTimeout }),
            }),
            chain: arbitrumE2eChain,
        });

        const walletBalanceBefore = await getTokenBalance(
            arbitrum.publicClient,
            token,
            walletAddress,
        );

        await scanForSweepableBalance(
            page,
            rescueFilePath,
            sweepItem,
            walletAddress,
        );
        await sweepItem.click();

        const refundButton = page.getByRole("button", {
            name: dict.en.refund,
            exact: true,
        });
        await expect(refundButton).toBeVisible({ timeout: actionTimeout });
        await refundButton.click();

        await expect(page.getByText(dict.en.refunded)).toBeVisible({
            timeout: actionTimeout,
        });

        await expect
            .poll(
                () =>
                    getTokenBalance(
                        arbitrum.publicClient,
                        token,
                        walletAddress,
                    ),
                {
                    timeout: actionTimeout,
                    message:
                        "sweep sends the stranded USDT0 to the connected wallet",
                },
            )
            .toBe(walletBalanceBefore + strandedAmount);
        expect(
            await getTokenBalance(
                arbitrum.publicClient,
                token,
                gasAbstractionAddress,
            ),
        ).toBe(0n);
    });
});
