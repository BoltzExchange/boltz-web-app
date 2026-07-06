import type { Account, Hash } from "viem";

import { PendingBridgeSendRecoveryStatus } from "../bridge/pendingSend.ts";
import { getSwapStatus } from "../client.ts";
import { postCommitmentSignatureForTransaction } from "../evm/commitment.ts";
import { assetAmountToSats } from "../evm/rootstock.ts";
import { buildSwapContractsForAsset } from "../evm/swapContracts.ts";
import { getLogger } from "../logger.ts";
import {
    isChainSwapClaimable,
    isFailureStatus,
    isFinalStatus,
} from "../status.ts";
import {
    awaitCctpMint,
    deriveCctpGuid,
    manualMint,
    recoverBurn,
    sponsoredCctpBurn,
} from "./bridge.ts";
import { DepositRefundableError } from "./errors.ts";
import { sponsoredCommitmentLock } from "./lockup.ts";
import { sponsoredCommitmentRefund } from "./refund.ts";
import { buildDepositSigner } from "./signer.ts";
import { claimChainOut, createOutSwap } from "./swapOut.ts";
import {
    type ApproveQuote,
    DEPOSIT_BRIDGE_ASSET,
    DepositPhase,
    type DepositRecord,
    type DepositStorage,
    type DetectedDeposit,
    type ResolveOut,
    isTerminalPhase,
} from "./types.ts";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

// Default Forwarded-mint poll deadline before falling back to a manual
// self-mint (5 minutes).
const defaultMintTimeoutMs = 5 * 60_000;
const defaultPollIntervalMs = 5_000;

export type EngineDeps = {
    account: Account;
    storage: DepositStorage;
    resolveOut: ResolveOut;
    approveQuote: ApproveQuote;
    onEvent?: (record: DepositRecord) => void;
    onError?: (error: unknown) => void;
    mintTimeoutMs?: number;
    pollIntervalMs?: number;
    signal?: AbortSignal;
    // Serializes all sponsored sends for the derived address (7702 nonce races).
    runExclusive: <T>(fn: () => Promise<T>) => Promise<T>;
};

const toDetected = (record: DepositRecord): DetectedDeposit => ({
    id: record.id,
    sourceAsset: record.sourceAsset,
    address: record.address,
    amount: BigInt(record.amount),
    txHash: record.txHash,
    logIndex: record.logIndex,
    blockNumber: record.blockNumber,
});

const bindCommitment = async (
    record: DepositRecord,
    deps: EngineDeps,
): Promise<void> => {
    const signer = buildDepositSigner(deps.account, DEPOSIT_BRIDGE_ASSET);
    const { erc20Swap } = await buildSwapContractsForAsset(
        DEPOSIT_BRIDGE_ASSET,
        signer,
    );
    await postCommitmentSignatureForTransaction({
        asset: DEPOSIT_BRIDGE_ASSET,
        commitmentAsset: DEPOSIT_BRIDGE_ASSET,
        swapId: record.swapId as string,
        preimageHash: record.preimageHash as string,
        commitmentTxHash: record.commitmentTxHash as Hash,
        erc20Swap,
        signer,
    });
};

// Poll swap status until the chain out-swap is claimable (then claim) or the
// swap reaches a terminal state.
const settle = async (
    record: DepositRecord,
    deps: EngineDeps,
): Promise<string | undefined> => {
    const pollMs = deps.pollIntervalMs ?? defaultPollIntervalMs;
    for (;;) {
        if (deps.signal?.aborted) {
            throw new Error("aborted");
        }
        const { status } = await getSwapStatus(record.swapId as string);
        if (record.swapKind === "chain" && isChainSwapClaimable({ status })) {
            return await claimChainOut(record);
        }
        if (isFinalStatus(status)) {
            if (isFailureStatus(status)) {
                // Refundable: the server did not (and will not) claim the
                // commitment, so the engine cooperatively refunds it rather
                // than wedging the record here on every resume.
                throw new DepositRefundableError(
                    `swap ${record.swapId} failed with status ${status}`,
                );
            }
            return record.claimTxId;
        }
        await sleep(pollMs);
    }
};

// Drive one deposit through the lock-first state machine, persisting the record
// at every boundary so a crash resumes idempotently at `record.phase`.
export const advanceDeposit = async (
    initial: DepositRecord,
    deps: EngineDeps,
): Promise<DepositRecord> => {
    const log = getLogger();
    let record = initial;

    const persist = async (next: DepositRecord): Promise<void> => {
        record = { ...next, updatedAt: Date.now() };
        await deps.storage.putDeposit(record);
        deps.onEvent?.(record);
    };

    const runPhase = async (): Promise<void> => {
        switch (record.phase) {
            case DepositPhase.Detected: {
                await persist({ ...record, phase: DepositPhase.Bridging });
                break;
            }

            case DepositPhase.Bridging: {
                if (
                    record.burnTxHash !== undefined &&
                    record.guid !== undefined
                ) {
                    await persist({
                        ...record,
                        phase: DepositPhase.AwaitingMint,
                    });
                    break;
                }
                if (record.pendingSend !== undefined) {
                    const recovery = await recoverBurn(
                        record.sourceAsset,
                        record.pendingSend,
                    );
                    if (
                        recovery.status ===
                        PendingBridgeSendRecoveryStatus.Recovered
                    ) {
                        // Re-derive the guid from the recovered burn tx: the
                        // recovery result carries only the tx hash, so without
                        // this AwaitingMint would poll with guid=undefined and
                        // crash in decodeCctpGuid on every resume.
                        await persist({
                            ...record,
                            burnTxHash: recovery.transactionHash,
                            guid: deriveCctpGuid(
                                record.sourceAsset,
                                recovery.transactionHash,
                            ),
                            phase: DepositPhase.AwaitingMint,
                        });
                        break;
                    }
                    if (
                        recovery.status ===
                        PendingBridgeSendRecoveryStatus.Failed
                    ) {
                        await persist({
                            ...record,
                            phase: DepositPhase.Failed,
                            error: "CCTP burn failed to broadcast",
                        });
                        break;
                    }
                    // Pending — wait and re-check rather than double-burning.
                    await sleep(deps.pollIntervalMs ?? defaultPollIntervalMs);
                    break;
                }

                const result = await deps.runExclusive(() =>
                    sponsoredCctpBurn({
                        sourceAsset: record.sourceAsset,
                        amount: BigInt(record.amount),
                        mintRecipient: record.address,
                        signer: buildDepositSigner(
                            deps.account,
                            record.sourceAsset,
                        ),
                        persistPending: async (pending) => {
                            await persist({ ...record, pendingSend: pending });
                        },
                    }),
                );
                await persist({
                    ...record,
                    burnTxHash: result.burnTxHash,
                    guid: result.guid,
                    cctpNonce: result.cctpNonce,
                    cctpMessage: result.cctpMessage,
                    pendingSend: result.pendingSend,
                    phase: DepositPhase.AwaitingMint,
                });
                break;
            }

            case DepositPhase.AwaitingMint: {
                // Persist the forwarded-mint deadline once so it survives both
                // in-loop re-entry and a resume; recomputing it each cycle would
                // never let the manual self-mint fallback take over.
                if (record.mintDeadline === undefined) {
                    await persist({
                        ...record,
                        mintDeadline:
                            Date.now() +
                            (deps.mintTimeoutMs ?? defaultMintTimeoutMs),
                    });
                }
                let mint = await awaitCctpMint({
                    sourceAsset: record.sourceAsset,
                    guid: record.guid as string,
                    mintRecipient: record.address,
                    deadlineMs: record.mintDeadline as number,
                    pollIntervalMs: deps.pollIntervalMs,
                    signal: deps.signal,
                });
                if (mint === undefined) {
                    mint = await deps.runExclusive(() =>
                        manualMint({
                            guid: record.guid as string,
                            signer: buildDepositSigner(
                                deps.account,
                                DEPOSIT_BRIDGE_ASSET,
                            ),
                        }),
                    );
                }
                if (mint === undefined) {
                    // Attestation not ready yet — back off and re-enter.
                    await sleep(deps.pollIntervalMs ?? defaultPollIntervalMs);
                    break;
                }
                await persist({
                    ...record,
                    mintTxHash: mint.mintTxHash,
                    mintedAmount: mint.mintedAmount.toString(),
                    phase: DepositPhase.Locking,
                });
                break;
            }

            case DepositPhase.Locking: {
                if (record.commitmentTxHash !== undefined) {
                    await persist({ ...record, phase: DepositPhase.Creating });
                    break;
                }
                const lock = await deps.runExclusive(() =>
                    sponsoredCommitmentLock({
                        amount: BigInt(record.mintedAmount as string),
                        signer: buildDepositSigner(
                            deps.account,
                            DEPOSIT_BRIDGE_ASSET,
                        ),
                    }),
                );
                await persist({
                    ...record,
                    commitmentTxHash: lock.commitmentTxHash,
                    commitmentLogIndex: lock.commitmentLogIndex,
                    phase: DepositPhase.Creating,
                });
                break;
            }

            case DepositPhase.Creating: {
                if (record.swapId !== undefined) {
                    await persist({
                        ...record,
                        phase: DepositPhase.AwaitingApproval,
                    });
                    break;
                }
                const mintedAmount = BigInt(record.mintedAmount as string);
                const mintedSats = Number(
                    assetAmountToSats(mintedAmount, DEPOSIT_BRIDGE_ASSET),
                );
                const bridgeFee = BigInt(record.amount) - mintedAmount;
                const target = await deps.resolveOut({
                    deposit: toDetected(record),
                    mintedAmount,
                    mintedSats,
                    suggestedReceiveSats: mintedSats,
                });
                const out = await createOutSwap({
                    depositId: record.id,
                    target,
                    mintedSats,
                    bridgeFee: bridgeFee < 0n ? 0n : bridgeFee,
                    signal: deps.signal,
                });
                await persist({
                    ...record,
                    target,
                    swapId: out.swapId,
                    swapKind: out.kind,
                    createdSwap: out.createdSwap,
                    preimage: out.preimage,
                    preimageHash: out.preimageHash,
                    claimPrivateKey: out.claimPrivateKey,
                    blindingKey: out.blindingKey,
                    receiveAmountSats: out.receiveAmountSats,
                    quote: out.quote,
                    phase: DepositPhase.AwaitingApproval,
                });
                break;
            }

            case DepositPhase.AwaitingApproval: {
                // Persist the decision before advancing so a resume does not
                // re-prompt the consumer for a quote they already answered
                // (whose underlying invoice/swap may have since expired).
                if (record.approved === undefined) {
                    const approved = await deps.approveQuote(
                        record.quote as never,
                    );
                    await persist({ ...record, approved });
                }
                await persist({
                    ...record,
                    phase: record.approved
                        ? DepositPhase.Binding
                        : DepositPhase.Refunding,
                });
                break;
            }

            case DepositPhase.Binding: {
                // Persist `bound` before advancing so a resume does not re-post
                // the commitment signature for an already-bound swap.
                if (record.bound !== true) {
                    await bindCommitment(record, deps);
                    await persist({ ...record, bound: true });
                }
                await persist({ ...record, phase: DepositPhase.Settling });
                break;
            }

            case DepositPhase.Settling: {
                // Persist the claim id before advancing so a resume does not
                // re-broadcast the chain claim against an already-spent lockup.
                // (Submarine out has no claim tx, so `claimTxId` stays undefined
                // and `settle` just re-polls to a terminal status — idempotent.)
                if (record.claimTxId === undefined) {
                    const claimTxId = await settle(record, deps);
                    if (claimTxId !== undefined) {
                        await persist({ ...record, claimTxId });
                    }
                }
                await persist({ ...record, phase: DepositPhase.Done });
                break;
            }

            case DepositPhase.Refunding: {
                // Persist the refund tx before advancing so a resume does not
                // re-broadcast a second sponsored refund for the same
                // commitment (which would revert and wedge the record here).
                if (record.refundTxHash === undefined) {
                    const refundTxHash = await deps.runExclusive(() =>
                        sponsoredCommitmentRefund({
                            commitmentTxHash: record.commitmentTxHash as string,
                            signer: buildDepositSigner(
                                deps.account,
                                DEPOSIT_BRIDGE_ASSET,
                            ),
                        }),
                    );
                    await persist({ ...record, refundTxHash });
                }
                await persist({
                    ...record,
                    phase: DepositPhase.Failed,
                    // A failure-routed refund carries its own cause in
                    // `record.error`; a quote rejection leaves it unset.
                    error:
                        record.error ?? "quote rejected — commitment refunded",
                });
                break;
            }

            case DepositPhase.Done:
            case DepositPhase.Failed:
                break;
        }
    };

    while (!isTerminalPhase(record.phase)) {
        if (deps.signal?.aborted) {
            throw new Error("aborted");
        }
        try {
            await runPhase();
        } catch (error) {
            if (!(error instanceof DepositRefundableError)) {
                throw error; // transient — let the watcher retry the deposit
            }
            // Business failure (out-swap rejected, or the swap reached a
            // failure status): refund the locked commitment, or fail outright
            // when nothing was locked yet. The loop then drives the new phase.
            await persist({
                ...record,
                phase:
                    record.commitmentTxHash !== undefined
                        ? DepositPhase.Refunding
                        : DepositPhase.Failed,
                error: error.message,
            });
        }
    }

    log.info("Deposit reached terminal phase", {
        id: record.id,
        phase: record.phase,
    });
    return record;
};

export const resumeDeposit = advanceDeposit;
