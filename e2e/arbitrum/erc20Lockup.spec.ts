import { erc20SwapAbi } from "boltz-swaps/generated/evm-abis";
import {
    type Hex,
    type PublicClient,
    createWalletClient,
    getAddress,
    http,
    parseEventLogs,
    parseUnits,
} from "viem";

import { injectWalletProvider } from "../fixtures/ethereum";
import {
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
    createSwap,
    describeArbitrumE2e,
    expect,
    fundErc20FromWhale,
    getRegtestTokenAddress,
    getStablesE2eWalletAddress,
    test,
    testTimeout,
    waitForLockupTxHash,
} from "./shared";

const tbtcFundingSource = getAddress(
    process.env.TBTC_E2E_ARB_FUNDING_SOURCE ??
        "0xCb198a55e2a88841E855bE4EAcaad99422416b33",
);
const tbtcSendAmount = "0.001";
const tbtcFundingAmount = parseUnits("0.01", 18);

const expectLockupTx = async (publicClient: PublicClient, txHash: Hex) => {
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: actionTimeout,
    });
    expect(receipt.status).toBe("success");

    const [lockup] = parseEventLogs({
        abi: erc20SwapAbi,
        eventName: "Lockup",
        logs: receipt.logs,
    });
    expect(lockup).toBeDefined();
    expect(lockup.args.amount).toBeGreaterThan(0n);
};

describeArbitrumE2e("Arbitrum ERC20 lockup e2e", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
        await generateBitcoinBlock();
        await generateLiquidBlock();
    });

    test("locks TBTC via Permit2 and claims an L-BTC chain swap", async ({
        arbitrum,
        page,
    }) => {
        test.setTimeout(testTimeout);

        const walletAddress = await getStablesE2eWalletAddress(
            arbitrum.publicClient,
        );
        const walletClient = createWalletClient({
            account: walletAddress,
            chain: arbitrumE2eChain,
            transport: http(arbitrumRpcUrl(), { timeout: actionTimeout }),
        });

        await fundErc20FromWhale({
            publicClient: arbitrum.publicClient,
            chain: arbitrumE2eChain,
            rpcUrl: arbitrum.rpcUrl,
            token: getRegtestTokenAddress("TBTC"),
            whale: tbtcFundingSource,
            recipient: walletAddress,
            amount: tbtcFundingAmount,
        });
        await clearEoaDelegation(arbitrum.publicClient, walletAddress);

        await injectWalletProvider({
            page,
            publicClient: arbitrum.publicClient,
            walletClient,
            chain: arbitrumE2eChain,
        });

        const swapId = await createSwap(
            page,
            "TBTC",
            "L-BTC",
            await getLiquidAddress(),
            tbtcSendAmount,
            { walletAddress },
        );

        await approveAndSend(page, walletAddress);
        await expectLockupTx(
            arbitrum.publicClient,
            await waitForLockupTxHash(page, swapId),
        );

        const claimed = page.locator("div[data-status='transaction.claimed']");
        await expect(async () => {
            await generateLiquidBlock();
            await expect(claimed).toBeVisible({ timeout: 5_000 });
        }).toPass({ timeout: actionTimeout });
    });
});
