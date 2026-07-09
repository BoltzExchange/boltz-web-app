import type { Locator, Page, Response } from "@playwright/test";
import {
    type Address,
    type PublicClient,
    createWalletClient,
    getAddress,
    http,
    parseUnits,
} from "viem";

import { config } from "../../src/config";
import dict from "../../src/i18n/i18n";
import { injectWalletProvider } from "../fixtures/ethereum";
import {
    execCommand,
    generateBitcoinBlock,
    generateLiquidBlock,
    getLiquidAddress,
} from "../utils";
import {
    actionTimeout,
    approveAndSend,
    arbitrumE2eChain,
    arbitrumRpcUrl,
    clearEoaDelegation,
    connectWallet,
    createSwap,
    describeArbitrumE2e,
    expect,
    fundErc20FromWhale,
    getRegtestTokenAddress,
    getTokenBalance,
    lbtcSendAmount,
    mineArbitrumBlocks,
    stablesFundingSource,
    test,
    usdt0EthSendAmount,
    waitForDexQuote,
    waitForLockupTxHash,
} from "./shared";

const originalAssetRescueTimeout = 240_000;
const usdt0FundingAmount = parseUnits("500", 6);
const refundWalletIndex = 8;
const claimWalletIndex = 9;

const getArbitrumWalletAddress = async (
    pageClient: PublicClient,
    index: number,
): Promise<Address> => {
    const accounts = (await pageClient.request({
        method: "eth_accounts",
        params: [],
    } as never)) as Address[];
    const walletAddress = accounts[index];
    if (walletAddress === undefined) {
        throw new Error(`Arbitrum account #${index} is not available in Anvil`);
    }

    return getAddress(walletAddress);
};

const clearBrowserStorage = async (page: Page) => {
    await page.evaluate(async () => {
        window.localStorage.clear();

        await Promise.all(
            ["swaps", "lastUsedEvmIndex"].map(
                (name) =>
                    new Promise<void>((resolve, reject) => {
                        const request = indexedDB.deleteDatabase(name);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                        request.onblocked = () =>
                            reject(new Error(`deleting ${name} was blocked`));
                    }),
            ),
        );
    });
};

const isMetadataPatchResponse = (response: Response, swapId: string) => {
    const request = response.request();
    if (request.method() !== "PATCH") {
        return false;
    }

    return new URL(response.url()).pathname === `/v2/swap/${swapId}/metadata`;
};

const waitForMetadataPatch = async (page: Page, swapId: string) => {
    const response = await page.waitForResponse(
        (res) => isMetadataPatchResponse(res, swapId),
        { timeout: actionTimeout },
    );

    expect(response.ok()).toBe(true);
    const body = response.request().postDataJSON() as { metadata?: unknown };
    expect(typeof body.metadata).toBe("string");
    expect(body.metadata).toMatch(/^[0-9a-f]+$/);

    return response;
};

const hasRestoredMetadataForSwap = (body: unknown, swapId: string) =>
    Array.isArray(body) &&
    body.some((value) => {
        if (typeof value !== "object" || value === null) {
            return false;
        }

        const swap = value as { id?: unknown; metadata?: unknown };
        return (
            swap.id === swapId &&
            typeof swap.metadata === "string" &&
            /^[0-9a-f]+$/.test(swap.metadata)
        );
    });

const waitForMetadataRestore = async (page: Page, swapId: string) => {
    await page.waitForResponse(
        async (response) => {
            const request = response.request();
            if (
                request.method() !== "POST" ||
                new URL(response.url()).pathname !== "/v2/swap/restore" ||
                !response.ok()
            ) {
                return false;
            }

            return hasRestoredMetadataForSwap(
                await response.json().catch(() => undefined),
                swapId,
            );
        },
        { timeout: actionTimeout },
    );
};

const fetchChainPairHash = async (from: string, to: string) => {
    const response = await fetch(`${config.apiUrl.normal}/v2/swap/chain`, {
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        return undefined;
    }

    const pairs = (await response.json()) as Record<
        string,
        Record<string, { hash?: unknown }>
    >;
    const hash = pairs[from]?.[to]?.hash;
    return typeof hash === "string" ? hash : undefined;
};

const waitForStableChainPairHash = async (from: string, to: string) => {
    let previous: string | undefined;
    let stableReads = 0;

    await expect
        .poll(
            async () => {
                const hash = await fetchChainPairHash(from, to).catch(
                    () => undefined,
                );
                if (hash === undefined) {
                    previous = undefined;
                    stableReads = 0;
                    return "";
                }

                if (hash === previous) {
                    stableReads += 1;
                } else {
                    previous = hash;
                    stableReads = 0;
                }

                return stableReads >= 2 ? hash : "";
            },
            {
                timeout: actionTimeout,
                intervals: [1_000, 2_000, 2_000],
                message: `${from} -> ${to} chain pair hash is stable`,
            },
        )
        .toMatch(/^[0-9a-f]{64}$/);
};

const blockCommitmentSubmission = async (page: Page) => {
    let commitmentPosts = 0;

    await page.route("**/v2/commitment/*", async (route, request) => {
        const isRefund = new URL(request.url()).pathname.endsWith("/refund");
        if (request.method() !== "POST" || isRefund) {
            await route.continue();
            return;
        }

        commitmentPosts += 1;
        await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
                error: "insufficient amount: 16643 < 16650",
            }),
        });
    });

    return () => commitmentPosts;
};

const elementsSendToAddressNoRbf = (address: string, amount: string) =>
    execCommand(
        `elements-cli-sim-client -named sendtoaddress address="${address}" amount=${amount} replaceable=false`,
    );

const expectAssetPair = async (item: Locator, from: string, to: string) => {
    await expect(item.locator(`.asset[data-asset='${from}']`)).toBeVisible();
    await expect(item.locator(`.asset[data-asset='${to}']`)).toBeVisible();
};

const startExternalRescue = async (page: Page) => {
    await page.goto("/rescue");
    await page
        .getByRole("button", { name: dict.en.rescue_external_swap })
        .click();
};

const scanAndSelectExternalResult = async ({
    page,
    swapId,
    walletAddress,
    rescueFilePath,
    action,
    assets,
}: {
    page: Page;
    swapId: string;
    walletAddress: Address;
    rescueFilePath: string;
    action: string;
    assets: [string, string];
}) => {
    const resultItems = page.locator(".rescue-external-results .swaplist-item");
    const actionItem = resultItems
        .filter({
            has: page.getByRole("link", {
                name: action,
                exact: true,
            }),
        })
        .first();

    await expect(async () => {
        await startExternalRescue(page);
        await page.getByTestId("refundUpload").setInputFiles(rescueFilePath);
        await connectWallet(page, walletAddress);
        const metadataRestore = waitForMetadataRestore(page, swapId);
        await page
            .getByRole("button", { name: dict.en.rescue, exact: true })
            .click();
        await metadataRestore;

        await expect(actionItem).toBeVisible({ timeout: actionTimeout });
        await expect(resultItems).toHaveCount(1);
        await expectAssetPair(actionItem, ...assets);
    }).toPass({
        timeout: actionTimeout * 2,
        intervals: [2_000, 5_000, 10_000],
    });

    await actionItem.click();
};

describeArbitrumE2e("Arbitrum original-asset external rescue e2e", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("refunds a pre-DEX commitment lockup back to USDT0", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(originalAssetRescueTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const walletAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            refundWalletIndex,
        );
        const token = getRegtestTokenAddress("USDT0");

        await fundErc20FromWhale({
            publicClient: arbitrum.publicClient,
            chain: arbitrumE2eChain,
            rpcUrl: arbitrum.rpcUrl,
            token,
            whale: stablesFundingSource,
            recipient: walletAddress,
            amount: usdt0FundingAmount,
        });
        await clearEoaDelegation(arbitrum.publicClient, walletAddress);
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
        const commitmentPosts = await blockCommitmentSubmission(page);

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("USDT0"),
            tokenOut: getRegtestTokenAddress("TBTC"),
            amountIn: parseUnits("39.996", 6),
            label: "USDT0 -> TBTC",
        });
        await waitForStableChainPairHash("TBTC", "L-BTC");

        const swapId = await createSwap(
            page,
            "USDT0",
            "L-BTC",
            await getLiquidAddress(),
            usdt0EthSendAmount,
            { walletAddress, rescueFilePath },
        );
        const metadataPatch = waitForMetadataPatch(page, swapId);

        await approveAndSend(page, walletAddress);
        await waitForLockupTxHash(page, swapId);
        await metadataPatch;

        await expect(
            page.getByText(dict.en.commitment_rejected_line),
        ).toBeVisible({ timeout: actionTimeout });
        expect(commitmentPosts()).toBeGreaterThan(0);

        const balanceAfterLockup = await getTokenBalance(
            arbitrum.publicClient,
            token,
            walletAddress,
        );

        await clearBrowserStorage(page);

        await scanAndSelectExternalResult({
            page,
            swapId,
            walletAddress,
            rescueFilePath,
            action: dict.en.refund,
            assets: ["USDT", "LBTC"],
        });

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("TBTC"),
            tokenOut: getRegtestTokenAddress("USDT0"),
            amountIn: parseUnits("0.0007", 18),
            label: "TBTC -> USDT0 refund",
        });

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
                async () =>
                    await getTokenBalance(
                        arbitrum.publicClient,
                        token,
                        walletAddress,
                    ),
                {
                    timeout: actionTimeout,
                    message: "external rescue refunds the original USDT0 asset",
                },
            )
            .toBeGreaterThan(balanceAfterLockup);
    });

    test("claims a post-DEX lockup to the original USDT0 destination", async ({
        arbitrum,
        page,
    }, testInfo) => {
        test.setTimeout(originalAssetRescueTimeout);

        const rescueFilePath = testInfo.outputPath("rescue-file.json");
        const walletAddress = await getArbitrumWalletAddress(
            arbitrum.publicClient,
            claimWalletIndex,
        );
        const token = getRegtestTokenAddress("USDT0");

        await clearEoaDelegation(arbitrum.publicClient, walletAddress);
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

        await waitForDexQuote({
            tokenIn: getRegtestTokenAddress("TBTC"),
            tokenOut: getRegtestTokenAddress("USDT0"),
            amountIn: parseUnits(lbtcSendAmount, 18),
            label: "TBTC -> USDT0",
        });
        await waitForStableChainPairHash("L-BTC", "TBTC");

        const balanceBeforeClaim = await getTokenBalance(
            arbitrum.publicClient,
            token,
            walletAddress,
        );

        const swapId = await createSwap(
            page,
            "L-BTC",
            "USDT0",
            walletAddress,
            lbtcSendAmount,
            { walletAddress, rescueFilePath },
        );

        await page
            .locator("div[data-testid='pay-onchain-buttons']")
            .getByText("address")
            .click();
        const lockupAddress = await page.evaluate(() =>
            navigator.clipboard.readText(),
        );
        expect(lockupAddress).toBeDefined();

        await elementsSendToAddressNoRbf(lockupAddress, lbtcSendAmount);
        await generateLiquidBlock();

        await clearBrowserStorage(page);

        await scanAndSelectExternalResult({
            page,
            swapId,
            walletAddress,
            rescueFilePath,
            action: dict.en.claim,
            assets: ["LBTC", "USDT"],
        });

        const continueButton = page.getByRole("button", {
            name: dict.en.continue,
            exact: true,
        });
        await expect(continueButton).toBeVisible({ timeout: actionTimeout });
        await continueButton.click();

        await expect(page.getByText(dict.en.claimed)).toBeVisible({
            timeout: actionTimeout,
        });
        await mineArbitrumBlocks(arbitrum.publicClient, 1);
        await expect
            .poll(
                async () =>
                    await getTokenBalance(
                        arbitrum.publicClient,
                        token,
                        walletAddress,
                    ),
                {
                    timeout: actionTimeout,
                    message: "external rescue claims the original USDT0 asset",
                },
            )
            .toBeGreaterThan(balanceBeforeClaim);
    });
});
