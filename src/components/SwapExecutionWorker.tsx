import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import log from "loglevel";
import { createEffect, onCleanup, onMount } from "solid-js";

import {
    type AlchemyCall,
    toAlchemyCall,
    waitForPreparedCallTransactionHash,
} from "../alchemy/Alchemy";
import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import { getTokenAddress } from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import { swapStatusPending } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    createRouterContract,
    createTokenContract,
    useWeb3Signer,
} from "../context/Web3";
import {
    encodeDexQuote,
    getCommitmentLockupDetails,
} from "../utils/boltzClient";
import { bridgeRegistry } from "../utils/bridge";
import { calculateAmountOutMin } from "../utils/calculate";
import { getSolanaConnection } from "../utils/chains/solana";
import { postCommitmentSignatureForTransaction } from "../utils/commitment";
import { sendPopulatedTransaction } from "../utils/evmTransaction";
import { decodeInvoice } from "../utils/invoice";
import { createAssetProvider } from "../utils/provider";
import { fetchDexQuote } from "../utils/quoter";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    type ChainSwap,
    GasAbstractionType,
    type SomeSwap,
    type SubmarineSwap,
    getLockupGasAbstraction,
} from "../utils/swapCreator";

const retryIntervalMs = 1_000;
const taskRetryIntervalMs = 3_000;
const emptyPreimageHash = prefix0x("00".repeat(32));

const sleep = (ms: number) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

const getSwapExecutionLogContext = (
    swapId: string,
    extra: Record<string, unknown> = {},
) => ({
    swapId,
    ...extra,
});

const withBrowserLock = async <T,>(name: string, fn: () => Promise<T>) => {
    if (navigator.locks?.request === undefined) {
        return await fn();
    }

    return await navigator.locks.request(name, fn);
};

const isPendingCommitmentStatus = (status?: string) =>
    status === undefined ||
    status === swapStatusPending.InvoiceSet ||
    status === swapStatusPending.SwapCreated;

const getCommitmentChainAsset = (swap: SomeSwap) =>
    swap.bridge?.position === SwapPosition.Pre
        ? swap.bridge.destinationAsset
        : swap.assetSend;

const getPreBridgeCommitmentClaimAddress = (swap: SomeSwap) =>
    swap.type === SwapType.Chain
        ? (swap as ChainSwap).lockupDetails.claimAddress
        : swap.claimAddress;

const getSwapPreimageHash = (swap: SomeSwap): string => {
    switch (swap.type) {
        case SwapType.Submarine:
            return decodeInvoice((swap as SubmarineSwap).invoice).preimageHash;

        case SwapType.Chain:
            return hex.encode(sha256(hex.decode((swap as ChainSwap).preimage)));

        default:
            throw new Error(
                `unsupported swap type for commitment execution: ${swap.type}`,
            );
    }
};

const needsPreBridgeLockup = (swap: SomeSwap | null | undefined) =>
    swap !== undefined &&
    swap !== null &&
    swap.bridge?.position === SwapPosition.Pre &&
    swap.bridge.txHash !== undefined &&
    swap.commitmentLockupTxHash === undefined &&
    isPendingCommitmentStatus(swap.status) &&
    swap.dex !== undefined &&
    swap.dex.position === SwapPosition.Pre &&
    swap.dex.hops.length > 0;

const needsCommitmentPost = (swap: SomeSwap | null | undefined) =>
    swap !== undefined &&
    swap !== null &&
    swap.commitmentLockupTxHash !== undefined &&
    !swap.commitmentSignatureSubmitted &&
    isPendingCommitmentStatus(swap.status);

type TaskStage = "pre-bridge" | "commitment";

const enum CommitmentLockupTransactionSource {
    Recovered = "recovered",
    Resumed = "resumed",
    Broadcast = "broadcast",
}

const enum PreBridgeCommitmentLockupRecoveryStatus {
    Recovered = "recovered",
    Ambiguous = "ambiguous",
    NotFound = "not-found",
}

type PreBridgeCommitmentLockupRecoveryResult =
    | {
          status: PreBridgeCommitmentLockupRecoveryStatus.Recovered;
          transactionHash: string;
      }
    | {
          status: PreBridgeCommitmentLockupRecoveryStatus.Ambiguous;
      }
    | {
          status: PreBridgeCommitmentLockupRecoveryStatus.NotFound;
      };

const isTaskRelevant = (
    stage: TaskStage,
    swap: SomeSwap | null | undefined,
) => {
    switch (stage) {
        case "pre-bridge":
            return needsPreBridgeLockup(swap);

        case "commitment":
            return needsCommitmentPost(swap);

        default: {
            const exhaustiveStage: never = stage;
            throw new Error(
                `unsupported swap execution stage: ${String(exhaustiveStage)}`,
            );
        }
    }
};

export const SwapExecutionWorker = () => {
    const { getSwap, getSwaps, setSwapStorage, slippage } = useGlobalContext();
    const { swap, setSwap } = usePayContext();
    const { getErc20Swap, getGasAbstractionSigner, signer } = useWeb3Signer();

    const runningTasks = new Set<string>();
    const scheduledRetries = new Map<string, number>();

    const persistSwap = async (updatedSwap: SomeSwap) => {
        await setSwapStorage(updatedSwap);

        if (swap()?.id === updatedSwap.id) {
            setSwap(updatedSwap);
        }
    };

    const persistCommitmentLockupTransaction = async (
        swapId: string,
        commitmentLockupTxHash: string,
        source: CommitmentLockupTransactionSource,
    ) => {
        const latestSwap = await getSwap<SomeSwap>(swapId);
        if (latestSwap === undefined || latestSwap === null) {
            return false;
        }

        latestSwap.commitmentLockupTxHash = commitmentLockupTxHash;
        latestSwap.commitmentLockupCallId = undefined;
        latestSwap.commitmentSignatureSubmitted = false;
        await persistSwap(latestSwap);
        log.info(
            `Swap execution persisted ${source} commitment lockup transaction`,
            getSwapExecutionLogContext(latestSwap.id, {
                commitmentLockupTxHash,
            }),
        );
        queueRelevantTasks(latestSwap);
        return true;
    };

    const recoverPreBridgeCommitmentLockup = async (
        currentSwap: SomeSwap,
        receivedEvent: {
            blockNumber: number;
        },
        gasAbstractionSigner: {
            address: string;
        },
    ): Promise<PreBridgeCommitmentLockupRecoveryResult> => {
        const commitmentAsset = currentSwap.assetSend;
        const erc20Swap = getErc20Swap(commitmentAsset).connect(
            createAssetProvider(commitmentAsset),
        );
        const lockupLogs = await erc20Swap.queryFilter(
            erc20Swap.filters.Lockup(),
            receivedEvent.blockNumber,
            "latest",
        );
        const claimAddress = getPreBridgeCommitmentClaimAddress(currentSwap);
        if (typeof claimAddress !== "string") {
            log.warn(
                "Swap execution cannot recover pre-bridge commitment lockup without claim address",
                getSwapExecutionLogContext(currentSwap.id, {
                    commitmentAsset,
                    fromBlock: receivedEvent.blockNumber,
                }),
            );
            return {
                status: PreBridgeCommitmentLockupRecoveryStatus.NotFound,
            };
        }
        const tokenAddress = getTokenAddress(commitmentAsset);
        const matchingLockups = lockupLogs.flatMap((event) => {
            const parsedLog = erc20Swap.interface.parseLog({
                data: event.data,
                topics: [...event.topics],
            });
            if (parsedLog?.name !== "Lockup") {
                return [];
            }

            const {
                preimageHash,
                tokenAddress: lockupTokenAddress,
                claimAddress: lockupClaimAddress,
                refundAddress,
            } = parsedLog.args;
            const matches =
                typeof event.transactionHash === "string" &&
                preimageHash.toLowerCase() ===
                    emptyPreimageHash.toLowerCase() &&
                lockupTokenAddress.toLowerCase() ===
                    tokenAddress.toLowerCase() &&
                lockupClaimAddress.toLowerCase() ===
                    claimAddress.toLowerCase() &&
                refundAddress.toLowerCase() ===
                    gasAbstractionSigner.address.toLowerCase();

            if (!matches) {
                return [];
            }

            return [
                {
                    transactionHash: event.transactionHash,
                    logIndex: event.index,
                },
            ];
        });

        if (matchingLockups.length === 1) {
            const recovered = matchingLockups[0];
            log.info(
                "Swap execution recovered pre-bridge commitment lockup",
                getSwapExecutionLogContext(currentSwap.id, {
                    commitmentAsset,
                    commitmentLockupTxHash: recovered.transactionHash,
                    fromBlock: receivedEvent.blockNumber,
                    logIndex: recovered.logIndex,
                }),
            );
            return {
                status: PreBridgeCommitmentLockupRecoveryStatus.Recovered,
                transactionHash: recovered.transactionHash,
            };
        }

        if (matchingLockups.length > 1) {
            log.warn(
                "Swap execution found multiple matching pre-bridge commitment lockups",
                getSwapExecutionLogContext(currentSwap.id, {
                    commitmentAsset,
                    fromBlock: receivedEvent.blockNumber,
                    matches: matchingLockups.map((lockup) => ({
                        transactionHash: lockup.transactionHash,
                        logIndex: lockup.logIndex,
                    })),
                }),
            );
            return {
                status: PreBridgeCommitmentLockupRecoveryStatus.Ambiguous,
            };
        }

        return {
            status: PreBridgeCommitmentLockupRecoveryStatus.NotFound,
        };
    };

    const abandonFailedBridgeSend = async (
        swapId: string,
        sourceAsset: string,
        txHash: string,
        blockNumber?: number,
    ) => {
        const latestSwap = await getSwap<SomeSwap>(swapId);
        if (
            latestSwap === undefined ||
            latestSwap === null ||
            latestSwap.bridge === undefined
        ) {
            return;
        }

        latestSwap.bridge = {
            ...latestSwap.bridge,
            txHash: undefined,
        };
        await persistSwap(latestSwap);
        log.warn(
            "Swap execution abandoning failed bridge send transaction",
            getSwapExecutionLogContext(swapId, {
                sourceAsset,
                txHash,
                blockNumber,
            }),
        );
    };

    const waitForBridgeSendReceipt = async (
        swapId: string,
        sourceAsset: string,
        txHash: string,
    ) => {
        const bridgeDriver = bridgeRegistry.requireDriverForAsset(sourceAsset);
        const sourceProvider = bridgeDriver.getProvider(sourceAsset);

        log.debug(
            "Swap execution waiting for bridge send receipt",
            getSwapExecutionLogContext(swapId, {
                sourceAsset,
                txHash,
            }),
        );

        while (true) {
            const currentSwap = await getSwap<SomeSwap>(swapId);
            if (!needsPreBridgeLockup(currentSwap)) {
                log.debug(
                    "Swap execution stopped waiting for bridge send receipt",
                    getSwapExecutionLogContext(swapId, {
                        sourceAsset,
                        txHash,
                    }),
                );
                return undefined;
            }

            const receipt = await sourceProvider.getTransactionReceipt(txHash);
            if (receipt !== null) {
                log.info(
                    "Swap execution found bridge send receipt",
                    getSwapExecutionLogContext(swapId, {
                        sourceAsset,
                        txHash,
                        blockNumber: receipt.blockNumber,
                    }),
                );
                return receipt;
            }

            await sleep(retryIntervalMs);
        }
    };

    const waitForSolanaBridgeSendConfirmation = async (
        swapId: string,
        sourceAsset: string,
        txHash: string,
    ) => {
        const connection = await getSolanaConnection(sourceAsset);

        log.debug(
            "Swap execution waiting for Solana bridge send confirmation",
            getSwapExecutionLogContext(swapId, {
                sourceAsset,
                txHash,
            }),
        );

        while (true) {
            const currentSwap = await getSwap<SomeSwap>(swapId);
            if (!needsPreBridgeLockup(currentSwap)) {
                log.debug(
                    "Swap execution stopped waiting for Solana bridge send confirmation",
                    getSwapExecutionLogContext(swapId, {
                        sourceAsset,
                        txHash,
                    }),
                );
                return undefined;
            }

            const transaction = await connection.getTransaction(txHash, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
            });
            if (transaction !== null) {
                log.info(
                    "Swap execution found Solana bridge send confirmation",
                    getSwapExecutionLogContext(swapId, {
                        sourceAsset,
                        txHash,
                        slot: transaction.slot,
                    }),
                );
                return transaction;
            }

            await sleep(retryIntervalMs);
        }
    };

    const waitForBridgeReceiptByGuid = async (
        swapId: string,
        destinationAsset: string,
        guid: string,
        sourceAsset: string,
    ) => {
        const destinationChainId =
            config.assets?.[destinationAsset]?.network?.chainId;
        const bridgeRoute = {
            sourceAsset: destinationAsset,
            destinationAsset: sourceAsset,
        };
        const bridgeDriver = bridgeRegistry.requireDriverForRoute(bridgeRoute);
        const provider = bridgeDriver.getProvider(destinationAsset);
        const contract = await bridgeDriver.createContract(
            bridgeRoute,
            provider,
        );
        const bridgeContract = await bridgeDriver.getContract(bridgeRoute);

        log.debug(
            "Swap execution waiting for bridge receive event",
            getSwapExecutionLogContext(swapId, {
                destinationAsset,
                destinationChainId,
                guid,
                contractAddress: bridgeContract.address,
            }),
        );

        while (true) {
            const currentSwap = await getSwap<SomeSwap>(swapId);
            if (!needsPreBridgeLockup(currentSwap)) {
                log.debug(
                    "Swap execution stopped waiting for bridge receive event",
                    getSwapExecutionLogContext(swapId, {
                        destinationAsset,
                        guid,
                    }),
                );
                return undefined;
            }

            const receivedEvent = await bridgeDriver.getReceivedEventByGuid(
                contract,
                provider,
                bridgeContract.address,
                guid,
            );
            if (receivedEvent !== undefined) {
                log.info(
                    "Swap execution found bridge receive event",
                    getSwapExecutionLogContext(swapId, {
                        destinationAsset,
                        guid,
                        amountReceivedLD:
                            receivedEvent.amountReceivedLD.toString(),
                        logIndex: receivedEvent.logIndex,
                    }),
                );
                return receivedEvent;
            }

            await sleep(retryIntervalMs);
        }
    };

    const executePreBridgeLockup = async (currentSwap: SomeSwap) => {
        if (!needsPreBridgeLockup(currentSwap)) {
            return;
        }

        if (currentSwap.commitmentLockupCallId !== undefined) {
            log.info(
                "Swap execution resuming pending commitment lockup call",
                getSwapExecutionLogContext(currentSwap.id, {
                    callId: currentSwap.commitmentLockupCallId,
                }),
            );

            const commitmentLockupTxHash =
                await waitForPreparedCallTransactionHash(
                    currentSwap.commitmentLockupCallId,
                );
            await persistCommitmentLockupTransaction(
                currentSwap.id,
                commitmentLockupTxHash,
                CommitmentLockupTransactionSource.Resumed,
            );
            return;
        }

        log.info(
            "Swap execution resuming pre-bridge lockup",
            getSwapExecutionLogContext(currentSwap.id, {
                sourceAsset: currentSwap.bridge.sourceAsset,
                destinationAsset: currentSwap.bridge.destinationAsset,
                bridgeTxHash: currentSwap.bridge.txHash,
            }),
        );

        const bridgeDriver = bridgeRegistry.requireDriverForRoute(
            currentSwap.bridge,
        );
        const sourceBridge = await bridgeDriver.getContract(currentSwap.bridge);
        const sourceTransport = bridgeDriver.getTransport(
            currentSwap.bridge.sourceAsset,
        );
        let guid: string | undefined;

        switch (sourceTransport) {
            case NetworkTransport.Evm: {
                const sendReceipt = await waitForBridgeSendReceipt(
                    currentSwap.id,
                    currentSwap.bridge.sourceAsset,
                    currentSwap.bridge.txHash,
                );
                if (sendReceipt === undefined) {
                    return;
                }

                if (sendReceipt.status === 0) {
                    await abandonFailedBridgeSend(
                        currentSwap.id,
                        currentSwap.bridge.sourceAsset,
                        currentSwap.bridge.txHash,
                        sendReceipt.blockNumber,
                    );
                    return;
                }

                const sourceProvider = bridgeDriver.getProvider(
                    currentSwap.bridge.sourceAsset,
                );
                const sourceContract = await bridgeDriver.createContract(
                    currentSwap.bridge,
                    sourceProvider,
                );
                guid = bridgeDriver.getSentEvent(
                    sourceContract,
                    sendReceipt,
                    sourceBridge.address,
                ).guid;
                break;
            }

            case NetworkTransport.Solana: {
                const sendTransaction =
                    await waitForSolanaBridgeSendConfirmation(
                        currentSwap.id,
                        currentSwap.bridge.sourceAsset,
                        currentSwap.bridge.txHash,
                    );
                if (sendTransaction === undefined) {
                    return;
                }

                const logMessages = sendTransaction.meta?.logMessages;
                if (sendTransaction.meta?.err != null || logMessages == null) {
                    await abandonFailedBridgeSend(
                        currentSwap.id,
                        currentSwap.bridge.sourceAsset,
                        currentSwap.bridge.txHash,
                    );
                    return;
                }

                guid = bridgeDriver.getGuidFromSolanaLogs(logMessages);
                break;
            }

            case NetworkTransport.Tron:
                throw new Error(
                    `Unsupported bridge source transport for pre-lockup execution: ${sourceTransport}`,
                );

            default: {
                const exhaustive: never = sourceTransport;
                throw new Error(
                    `Unsupported bridge source transport for pre-lockup execution: ${String(exhaustive)}`,
                );
            }
        }

        if (guid === undefined) {
            throw new Error("Swap execution failed to find bridge send guid");
        }

        log.info(
            "Swap execution decoded bridge send guid",
            getSwapExecutionLogContext(currentSwap.id, {
                guid,
                contractAddress: sourceBridge.address,
            }),
        );
        const receivedEvent = await waitForBridgeReceiptByGuid(
            currentSwap.id,
            currentSwap.bridge.destinationAsset,
            guid,
            currentSwap.bridge.sourceAsset,
        );
        if (receivedEvent === undefined) {
            return;
        }

        const latestSwap = await getSwap<SomeSwap>(currentSwap.id);
        if (!needsPreBridgeLockup(latestSwap)) {
            return;
        }

        const commitmentLockupDetails = await getCommitmentLockupDetails(
            latestSwap.assetSend,
        );
        const hop = latestSwap.dex.hops[0];
        const gasAbstractionSigner = getGasAbstractionSigner(
            latestSwap.bridge.destinationAsset,
        );
        const recoveryResult = await recoverPreBridgeCommitmentLockup(
            latestSwap,
            receivedEvent,
            gasAbstractionSigner,
        );
        switch (recoveryResult.status) {
            case PreBridgeCommitmentLockupRecoveryStatus.Ambiguous:
                return;

            case PreBridgeCommitmentLockupRecoveryStatus.Recovered:
                await persistCommitmentLockupTransaction(
                    latestSwap.id,
                    recoveryResult.transactionHash,
                    CommitmentLockupTransactionSource.Recovered,
                );
                return;

            case PreBridgeCommitmentLockupRecoveryStatus.NotFound:
                break;
        }
        const receivedAmount = receivedEvent.amountReceivedLD;
        const expectedAmount = satsToAssetAmount(
            latestSwap.sendAmount,
            latestSwap.assetSend,
        );
        const quote = await fetchDexQuote(hop.dexDetails, receivedAmount);

        log.debug(
            "Swap execution fetched pre-bridge DEX quote",
            getSwapExecutionLogContext(latestSwap.id, {
                guid,
                amountReceived: receivedAmount.toString(),
                amountExpected: expectedAmount.toString(),
                quotedAmountOut: quote.trade.amountOut.toString(),
            }),
        );

        if (quote.trade.amountOut < expectedAmount) {
            log.warn("Bridge received amount is less than expected", {
                swapId: latestSwap.id,
                guid,
                amountReceived: receivedAmount.toString(),
                amountExpected: expectedAmount.toString(),
            });
            return;
        }

        const router = createRouterContract(
            latestSwap.assetSend,
            gasAbstractionSigner,
        );
        const routerAddress = await router.getAddress();
        const encoded = await encodeDexQuote(
            hop.dexDetails.chain,
            routerAddress,
            receivedAmount,
            calculateAmountOutMin(quote.trade.amountOut, slippage()),
            quote.trade.data,
        );

        const token = createTokenContract(
            latestSwap.bridge.destinationAsset,
            gasAbstractionSigner,
        );
        const transferData = token.interface.encodeFunctionData("transfer", [
            routerAddress,
            receivedAmount,
        ]);
        const calls: AlchemyCall[] = [
            {
                to: getTokenAddress(latestSwap.bridge.destinationAsset),
                value: "0",
                data: transferData,
            },
        ];

        log.info(
            "Swap execution broadcasting pre-bridge commitment lockup",
            getSwapExecutionLogContext(latestSwap.id, {
                guid,
                destinationAsset: latestSwap.bridge.destinationAsset,
                commitmentAsset: latestSwap.assetSend,
                amountReceived: receivedAmount.toString(),
            }),
        );
        const tx = await router.executeAndLockERC20.populateTransaction(
            prefix0x("00".repeat(32)),
            getTokenAddress(latestSwap.assetSend),
            getPreBridgeCommitmentClaimAddress(latestSwap),
            gasAbstractionSigner.address,
            commitmentLockupDetails.timelock,
            encoded.calls.map((call) => ({
                target: call.to,
                value: call.value,
                callData: prefix0x(call.data),
            })),
        );
        calls.push(toAlchemyCall(tx));

        try {
            latestSwap.commitmentLockupTxHash = await sendPopulatedTransaction(
                GasAbstractionType.Signer,
                gasAbstractionSigner,
                calls,
                {
                    alchemy: {
                        onPreparedCallId: async (callId) => {
                            latestSwap.commitmentLockupCallId = callId;
                            await persistSwap(latestSwap);
                            log.info(
                                "Swap execution persisted commitment lockup call ID",
                                getSwapExecutionLogContext(latestSwap.id, {
                                    callId,
                                }),
                            );
                        },
                    },
                },
            );
        } catch (error) {
            const recoveryResult = await recoverPreBridgeCommitmentLockup(
                latestSwap,
                receivedEvent,
                gasAbstractionSigner,
            );
            switch (recoveryResult.status) {
                case PreBridgeCommitmentLockupRecoveryStatus.Ambiguous:
                    return;

                case PreBridgeCommitmentLockupRecoveryStatus.Recovered:
                    await persistCommitmentLockupTransaction(
                        latestSwap.id,
                        recoveryResult.transactionHash,
                        CommitmentLockupTransactionSource.Recovered,
                    );
                    return;

                case PreBridgeCommitmentLockupRecoveryStatus.NotFound:
                    break;
            }

            throw error;
        }

        await persistCommitmentLockupTransaction(
            latestSwap.id,
            latestSwap.commitmentLockupTxHash,
            CommitmentLockupTransactionSource.Broadcast,
        );
    };

    const clearScheduledRetry = (taskId: string) => {
        const timeout = scheduledRetries.get(taskId);
        if (timeout === undefined) {
            return;
        }

        window.clearTimeout(timeout);
        scheduledRetries.delete(taskId);
    };

    const scheduleTaskRetry = (swapId: string, stage: TaskStage) => {
        const taskId = `${stage}:${swapId}`;
        if (scheduledRetries.has(taskId)) {
            log.debug("Swap execution task retry already scheduled", {
                taskId,
            });
            return;
        }

        const timeout = window.setTimeout(async () => {
            scheduledRetries.delete(taskId);

            const latestSwap = await getSwap<SomeSwap>(swapId);
            if (!isTaskRelevant(stage, latestSwap)) {
                log.debug(
                    "Swap execution task no longer relevant before retry",
                    {
                        taskId,
                        swapId,
                    },
                );
                return;
            }

            log.info("Swap execution retrying failed task", {
                taskId,
                swapId,
            });
            queueRelevantTasks(latestSwap);
        }, taskRetryIntervalMs);

        scheduledRetries.set(taskId, timeout);
        log.debug("Swap execution task retry scheduled", {
            taskId,
            swapId,
            retryDelayMs: taskRetryIntervalMs,
        });
    };

    const runTask = async (
        swapId: string,
        stage: TaskStage,
        handler: (currentSwap: SomeSwap) => Promise<void>,
    ) => {
        const taskId = `${stage}:${swapId}`;
        clearScheduledRetry(taskId);
        if (runningTasks.has(taskId)) {
            log.debug("Swap execution task already running", { taskId });
            return;
        }

        runningTasks.add(taskId);
        log.debug("Swap execution task started", { taskId });
        try {
            await withBrowserLock(`swapExecution:${taskId}`, async () => {
                const currentSwap = await getSwap<SomeSwap>(swapId);
                if (currentSwap === undefined || currentSwap === null) {
                    log.debug("Swap execution task skipped missing swap", {
                        taskId,
                    });
                    return;
                }

                await handler(currentSwap);
            });
            log.debug("Swap execution task completed", { taskId });
        } catch (error) {
            const latestSwap = await getSwap<SomeSwap>(swapId);
            if (!isTaskRelevant(stage, latestSwap)) {
                log.debug(
                    "Swap execution task no longer relevant after failure",
                    {
                        taskId,
                        swapId,
                    },
                );
                return;
            }

            log.warn(`swap execution task ${taskId} failed`, error);
            scheduleTaskRetry(swapId, stage);
        } finally {
            runningTasks.delete(taskId);
        }
    };

    const queueRelevantTasks = (currentSwap: SomeSwap | null | undefined) => {
        if (currentSwap === undefined || currentSwap === null) {
            return;
        }

        if (needsPreBridgeLockup(currentSwap)) {
            void runTask(currentSwap.id, "pre-bridge", async (storedSwap) => {
                await executePreBridgeLockup(storedSwap);
            });
        }

        if (needsCommitmentPost(currentSwap)) {
            void runTask(currentSwap.id, "commitment", async (storedSwap) => {
                const commitmentAsset = getCommitmentChainAsset(storedSwap);
                const transactionSigner =
                    storedSwap.bridge?.position === SwapPosition.Pre
                        ? getGasAbstractionSigner(
                              storedSwap.bridge.destinationAsset,
                          )
                        : getLockupGasAbstraction(storedSwap) ===
                            GasAbstractionType.Signer
                          ? getGasAbstractionSigner(commitmentAsset)
                          : signer();
                if (transactionSigner === undefined) {
                    log.debug(
                        "Swap execution waiting for connected signer to post commitment",
                        getSwapExecutionLogContext(storedSwap.id, {
                            commitmentLockupTxHash:
                                storedSwap.commitmentLockupTxHash,
                        }),
                    );
                    return;
                }

                log.info(
                    "Swap execution posting commitment signature",
                    getSwapExecutionLogContext(storedSwap.id, {
                        commitmentAsset,
                        commitmentLockupTxHash:
                            storedSwap.commitmentLockupTxHash,
                    }),
                );
                await postCommitmentSignatureForTransaction({
                    asset: storedSwap.assetSend,
                    swapId: storedSwap.id,
                    preimageHash: getSwapPreimageHash(storedSwap),
                    commitmentTxHash: storedSwap.commitmentLockupTxHash,
                    slippage: slippage(),
                    erc20Swap: getErc20Swap(commitmentAsset),
                    signer: transactionSigner,
                });

                storedSwap.commitmentSignatureSubmitted = true;
                await persistSwap(storedSwap);
                log.info(
                    "Swap execution marked commitment signature submitted",
                    getSwapExecutionLogContext(storedSwap.id, {
                        commitmentLockupTxHash:
                            storedSwap.commitmentLockupTxHash,
                    }),
                );
            });
        }
    };

    const scanStoredSwaps = async () => {
        const swaps = await getSwaps<SomeSwap>();
        log.debug("Swap execution scanning stored swaps", {
            count: swaps.length,
        });
        for (const currentSwap of swaps) {
            queueRelevantTasks(currentSwap);
        }
    };

    onMount(() => {
        void scanStoredSwaps();
    });

    createEffect(() => {
        queueRelevantTasks(swap());
    });

    createEffect(() => {
        signer();
        void scanStoredSwaps();
    });

    onCleanup(() => {
        for (const timeout of scheduledRetries.values()) {
            window.clearTimeout(timeout);
        }
        scheduledRetries.clear();
    });

    return "";
};
