import { createBoltzClient } from "boltz-swaps";
import { getCommitmentLockupDetails } from "boltz-swaps/client";
import { getTokenAddress } from "boltz-swaps/config";
import {
    type PopulatedEvmTransaction,
    buildSwapContractsForAsset,
    emptyPreimageHash,
    postCommitmentSignatureForTransaction,
    sendPopulatedTransaction,
} from "boltz-swaps/evm";
import { erc20Abi, erc20SwapAbi } from "boltz-swaps/generated/evm-abis";
import type { Signer } from "boltz-swaps/interfaces";
import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import {
    SwapStatus,
    isChainSwapClaimable,
    isFinalStatus,
} from "boltz-swaps/status";
import { GasAbstractionType } from "boltz-swaps/types";
import {
    type Hash,
    type Hex,
    encodeFunctionData,
    getAddress,
    parseEther,
} from "viem";

import { sponsoredCommitmentLock } from "../src/deposit/lockup.ts";
import { sponsoredCommitmentRefund } from "../src/deposit/refund.ts";
import {
    type OutSwapResult,
    claimChainOut,
    createOutSwap,
} from "../src/deposit/swapOut.ts";
import { DepositPhase, type DepositRecord } from "../src/deposit/types.ts";
import {
    ARBITRUM_RPC_URL,
    GAS_SPONSOR_URL,
    TBTC_TOKEN_ADDRESS,
    arbitrumPublicClient,
    fundTbtc,
    isArbitrumForkReachable,
    makeArbitrumSigner,
    tokenBalance,
} from "./arbitrum.ts";
import {
    BOLTZ_API_URL,
    elementsGetReceivedByAddress,
    generateLiquidBlock,
    getLiquidAddress,
    hasCommitmentSupport,
    refreshBackendBalanceCache,
    sleep,
    waitForAddressUtxos,
    waitForTxConfirmed,
} from "./regtest.ts";

// Regtest exposes commitment swaps and a chain pair for TBTC, not USDC.
const ASSET = "TBTC";
// TBTC has 18 decimals; Boltz sats are 8.
const satsToTokenAmount = (sats: number): bigint => BigInt(sats) * 10n ** 10n;

const stackReady =
    (await isArbitrumForkReachable()) && (await hasCommitmentSupport(ASSET));
const describeStack = stackReady ? describe : describe.skip;

describeStack("deposit on-chain actions (regtest)", () => {
    const arbitrumConfig = buildMainnetConfig({
        filterAssets: (asset) =>
            asset === "BTC" || asset === "L-BTC" || asset === ASSET,
        rpcUrls: { ARB: [ARBITRUM_RPC_URL] },
    });

    const boltz = createBoltzClient({
        ...arbitrumConfig,
        boltzApiUrl: BOLTZ_API_URL,
        network: "regtest",
        gasSponsor: GAS_SPONSOR_URL,
    });

    // The EVM pair hash tracks the fork's gas and refreshes on the backend's
    // own interval; retry a create that loses that race (or the balance-cache
    // race after funding).
    const createOutSwapWithRetry = async (
        args: Parameters<typeof createOutSwap>[0],
    ): Promise<OutSwapResult> => {
        const deadline = Date.now() + 30_000;
        for (;;) {
            try {
                return await createOutSwap(args);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                const retryable =
                    message.includes("invalid pair hash") ||
                    message.includes("insufficient liquidity");
                if (!retryable || Date.now() > deadline) {
                    throw e;
                }
                await sleep(1_000);
            }
        }
    };

    // The gas-sponsor emulator mines via anvil impersonation, so its txs carry
    // a zeroed signature and the backend rejects them when validating an EVM
    // user lockup. Lock direct-signed; the refund test covers the sponsored path.
    const directCommitmentLock = async (
        signer: Signer,
        amount: bigint,
    ): Promise<Hash> => {
        await signer.provider.request({
            method: "anvil_setBalance" as never,
            params: [
                signer.address,
                `0x${parseEther("1").toString(16)}`,
            ] as never,
        });
        const { contract, claimAddress, timelock } =
            await getCommitmentLockupDetails(ASSET);
        const tokenAddress = getAddress(getTokenAddress(ASSET));
        const sendDirect = (tx: PopulatedEvmTransaction) =>
            sendPopulatedTransaction(GasAbstractionType.None, signer, tx);

        const approveTxHash = await sendDirect({
            to: tokenAddress,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [getAddress(contract), amount],
            }),
        });
        await signer.provider.waitForTransactionReceipt({
            hash: approveTxHash,
        });

        const lockTxHash = await sendDirect({
            to: getAddress(contract),
            data: encodeFunctionData({
                abi: erc20SwapAbi,
                functionName: "lock",
                args: [
                    emptyPreimageHash as Hex,
                    amount,
                    tokenAddress,
                    getAddress(claimAddress),
                    getAddress(signer.address),
                    BigInt(timelock),
                ],
            }),
        });
        await signer.provider.waitForTransactionReceipt({ hash: lockTxHash });
        return lockTxHash;
    };

    const waitUntilClaimable = async (
        swapId: string,
        timeoutMs: number,
    ): Promise<void> => {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const { status } = await boltz.swap.status(swapId);
            if (isChainSwapClaimable({ status })) {
                return;
            }
            if (isFinalStatus(status)) {
                throw new Error(
                    `swap ${swapId} reached terminal status "${status}" before becoming claimable`,
                );
            }
            // The server's L-BTC lockup needs a block to confirm on regtest.
            if (status === SwapStatus.TransactionServerMempool) {
                await generateLiquidBlock();
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `timed out waiting for swap ${swapId} to become claimable (last status "${status}")`,
                );
            }
            await sleep(500);
        }
    };

    test("locks a commitment and cooperatively refunds it", async () => {
        const publicClient = arbitrumPublicClient();
        const signer = makeArbitrumSigner();
        const lockAmount = satsToTokenAmount(100_000);
        await fundTbtc(publicClient, signer.address, lockAmount);

        const balanceBefore = await tokenBalance(
            publicClient,
            TBTC_TOKEN_ADDRESS,
            signer.address,
        );

        const lock = await sponsoredCommitmentLock({
            amount: lockAmount,
            signer,
            asset: ASSET,
        });
        expect(lock.commitmentTxHash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(lock.commitmentLogIndex).toBeGreaterThanOrEqual(0);
        expect(
            await tokenBalance(
                publicClient,
                TBTC_TOKEN_ADDRESS,
                signer.address,
            ),
        ).toBe(balanceBefore - lockAmount);

        const refundTxHash = await sponsoredCommitmentRefund({
            commitmentTxHash: lock.commitmentTxHash,
            signer,
            asset: ASSET,
        });
        expect(refundTxHash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(
            await tokenBalance(
                publicClient,
                TBTC_TOKEN_ADDRESS,
                signer.address,
            ),
        ).toBe(balanceBefore);
    }, 120_000);

    test("locks a commitment, creates a chain out-swap, binds, and claims to L-BTC", async () => {
        const publicClient = arbitrumPublicClient();
        const signer = makeArbitrumSigner();
        const lockSats = 200_000;
        const lockAmount = satsToTokenAmount(lockSats);
        await fundTbtc(publicClient, signer.address, lockAmount);
        await refreshBackendBalanceCache("L-BTC");

        const commitmentTxHash = await directCommitmentLock(signer, lockAmount);

        const liquidAddress = await getLiquidAddress();
        const out = await createOutSwapWithRetry({
            depositId: "integration",
            target: { type: "chain", to: "L-BTC", address: liquidAddress },
            mintedSats: lockSats,
            bridgeFee: 0n,
            asset: ASSET,
        });
        expect(out.kind).toBe("chain");
        expect(out.lockAmountSats).toBe(lockSats);
        expect(out.quote.receiveAmountSats).toBeGreaterThan(0);

        // The engine's Binding phase, done by hand.
        const { erc20Swap } = await buildSwapContractsForAsset(ASSET, signer);
        await postCommitmentSignatureForTransaction({
            asset: ASSET,
            commitmentAsset: ASSET,
            swapId: out.swapId,
            preimageHash: out.preimageHash,
            commitmentTxHash,
            erc20Swap,
            signer,
        });

        await waitUntilClaimable(out.swapId, 90_000);

        const record: DepositRecord = {
            id: "integration",
            phase: DepositPhase.Settling,
            sourceAsset: "USDC-POL",
            address: signer.address,
            index: 0,
            createdAt: 0,
            updatedAt: 0,
            amount: lockAmount.toString(),
            txHash: commitmentTxHash,
            logIndex: 0,
            blockNumber: 0,
            swapKind: out.kind,
            createdSwap: out.createdSwap,
            target: { type: "chain", to: "L-BTC", address: liquidAddress },
            preimage: out.preimage,
            preimageHash: out.preimageHash,
            claimPrivateKey: out.claimPrivateKey,
            blindingKey: out.blindingKey,
            receiveAmountSats: out.receiveAmountSats,
        };
        const claimTxId = await claimChainOut(record);
        expect(claimTxId).toBeTruthy();

        await generateLiquidBlock();
        await waitForTxConfirmed("L-BTC", claimTxId);
        await waitForAddressUtxos("L-BTC", liquidAddress);
        expect(await elementsGetReceivedByAddress(liquidAddress)).toBe(
            out.receiveAmountSats,
        );
    }, 180_000);
});
