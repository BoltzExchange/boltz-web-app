import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import log from "loglevel";
import { createEffect, onCleanup, onMount } from "solid-js";

import { config } from "../config";
import { getTokenAddress } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { swapStatusPending } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    createRouterContract,
    createTokenContract,
    useWeb3Signer,
} from "../context/Web3";
import { HopsPosition } from "../utils/Pair";
import { encodeDexQuote } from "../utils/boltzClient";
import { calculateAmountWithSlippage } from "../utils/calculate";
import { postCommitmentSignatureForTransaction } from "../utils/commitment";
import {
    assertTransactionSignerProvider,
    sendPopulatedTransaction,
} from "../utils/evmTransaction";
import { decodeInvoice } from "../utils/invoice";
import {
    createOftContract,
    getOftContract,
    getOftProvider,
    getOftReceivedEventByGuid,
    getOftSentEvent,
} from "../utils/oft/oft";
import { fetchDexQuote } from "../utils/qouter";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    type ChainSwap,
    GasAbstractionType,
    OftPosition,
    type SomeSwap,
    type SubmarineSwap,
} from "../utils/swapCreator";

const retryIntervalMs = 1_000;
const taskRetryIntervalMs = 3_000;

const sleep = (ms: number) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

const getSwapExecutionLogContext = (
    swapId: string,
    extra: Record<string, unknown> = {},
) => ({
    swapId,
    ...extra,
});

const calculateAmountOutMin = (amountOut: bigint, slippage: number): bigint => {
    const amountWithSlippage = calculateAmountWithSlippage(amountOut, slippage);
    const slippageAmount = amountWithSlippage - amountOut;

    return amountOut - slippageAmount;
};

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
    swap.oft?.position === OftPosition.Pre
        ? swap.oft.destinationAsset
        : swap.assetSend;

const getSwapPreimageHash = async (swap: SomeSwap): Promise<string> => {
    switch (swap.type) {
        case SwapType.Submarine:
            return (await decodeInvoice((swap as SubmarineSwap).invoice))
                .preimageHash;

        case SwapType.Chain:
            return hex.encode(sha256(hex.decode((swap as ChainSwap).preimage)));

        default:
            throw new Error(
                `unsupported swap type for commitment execution: ${swap.type}`,
            );
    }
};

const getSwapTimeoutBlockHeight = (swap: SomeSwap) => {
    switch (swap.type) {
        case SwapType.Submarine:
            return (swap as SubmarineSwap).timeoutBlockHeight;

        case SwapType.Chain:
            return (swap as ChainSwap).lockupDetails.timeoutBlockHeight;

        default:
            throw new Error(
                `unsupported swap type for commitment execution: ${swap.type}`,
            );
    }
};

const needsPreOftLockup = (swap: SomeSwap | null | undefined) =>
    swap !== undefined &&
    swap !== null &&
    swap.oft?.position === OftPosition.Pre &&
    swap.oft.txHash !== undefined &&
    swap.commitmentLockupTxHash === undefined &&
    isPendingCommitmentStatus(swap.status) &&
    swap.dex !== undefined &&
    swap.dex.position === HopsPosition.Before &&
    swap.dex.hops.length > 0;

const needsCommitmentPost = (swap: SomeSwap | null | undefined) =>
    swap !== undefined &&
    swap !== null &&
    swap.commitmentLockupTxHash !== undefined &&
    !swap.commitmentSignatureSubmitted &&
    isPendingCommitmentStatus(swap.status);

type TaskStage = "pre-oft" | "commitment";

const isTaskRelevant = (
    stage: TaskStage,
    swap: SomeSwap | null | undefined,
) => {
    switch (stage) {
        case "pre-oft":
            return needsPreOftLockup(swap);

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

    const waitForOftSendReceipt = async (
        swapId: string,
        sourceAsset: string,
        txHash: string,
    ) => {
        const sourceProvider = getOftProvider(sourceAsset);

        log.debug(
            "Swap execution waiting for OFT send receipt",
            getSwapExecutionLogContext(swapId, {
                sourceAsset,
                txHash,
            }),
        );

        while (true) {
            const currentSwap = await getSwap<SomeSwap>(swapId);
            if (!needsPreOftLockup(currentSwap)) {
                log.debug(
                    "Swap execution stopped waiting for OFT send receipt",
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
                    "Swap execution found OFT send receipt",
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

    const waitForOftReceiptByGuid = async (
        swapId: string,
        destinationAsset: string,
        guid: string,
    ) => {
        const destinationChainId =
            config.assets?.[destinationAsset]?.network?.chainId;
        if (destinationChainId === undefined) {
            throw new Error(
                `missing OFT destination chain id for asset: ${destinationAsset}`,
            );
        }

        const oftContract = await getOftContract(destinationChainId);
        if (oftContract === undefined) {
            throw new Error(
                `missing OFT contract for chain: ${destinationChainId}`,
            );
        }

        const provider = assertTransactionSignerProvider(
            getGasAbstractionSigner(destinationAsset),
            "OFT destination signer",
        );
        const contract = createOftContract(oftContract.address, provider);

        log.debug(
            "Swap execution waiting for OFT receive event",
            getSwapExecutionLogContext(swapId, {
                destinationAsset,
                destinationChainId,
                guid,
                contractAddress: oftContract.address,
            }),
        );

        while (true) {
            const currentSwap = await getSwap<SomeSwap>(swapId);
            if (!needsPreOftLockup(currentSwap)) {
                log.debug(
                    "Swap execution stopped waiting for OFT receive event",
                    getSwapExecutionLogContext(swapId, {
                        destinationAsset,
                        guid,
                    }),
                );
                return undefined;
            }

            const receivedEvent = await getOftReceivedEventByGuid(
                contract,
                provider,
                oftContract.address,
                guid,
            );
            if (receivedEvent !== undefined) {
                log.info(
                    "Swap execution found OFT receive event",
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

    const executePreOftLockup = async (currentSwap: SomeSwap) => {
        if (!needsPreOftLockup(currentSwap)) {
            return;
        }

        log.info(
            "Swap execution resuming pre-OFT lockup",
            getSwapExecutionLogContext(currentSwap.id, {
                sourceAsset: currentSwap.oft.sourceAsset,
                destinationAsset: currentSwap.oft.destinationAsset,
                oftTxHash: currentSwap.oft.txHash,
            }),
        );

        const sourceChainId =
            config.assets?.[currentSwap.oft.sourceAsset]?.network?.chainId;
        if (sourceChainId === undefined) {
            throw new Error(
                `missing OFT source chain id for asset: ${currentSwap.oft.sourceAsset}`,
            );
        }

        const sourceOft = await getOftContract(sourceChainId);
        if (sourceOft === undefined) {
            throw new Error(`missing OFT contract for chain: ${sourceChainId}`);
        }

        const sendReceipt = await waitForOftSendReceipt(
            currentSwap.id,
            currentSwap.oft.sourceAsset,
            currentSwap.oft.txHash,
        );
        if (sendReceipt === undefined) {
            return;
        }

        const sourceProvider = getOftProvider(currentSwap.oft.sourceAsset);
        const sourceContract = createOftContract(
            sourceOft.address,
            sourceProvider,
        );
        const { guid } = getOftSentEvent(
            sourceContract,
            sendReceipt,
            sourceOft.address,
        );
        log.info(
            "Swap execution decoded OFT send guid",
            getSwapExecutionLogContext(currentSwap.id, {
                guid,
                contractAddress: sourceOft.address,
            }),
        );
        const receivedEvent = await waitForOftReceiptByGuid(
            currentSwap.id,
            currentSwap.oft.destinationAsset,
            guid,
        );
        if (receivedEvent === undefined) {
            return;
        }

        const latestSwap = await getSwap<SomeSwap>(currentSwap.id);
        if (!needsPreOftLockup(latestSwap)) {
            return;
        }

        const hop = latestSwap.dex.hops[0];
        const gasAbstractionSigner = getGasAbstractionSigner(
            latestSwap.oft.destinationAsset,
        );
        const receivedAmount = receivedEvent.amountReceivedLD;
        const expectedAmount = satsToAssetAmount(
            latestSwap.sendAmount,
            latestSwap.assetSend,
        );
        const quote = await fetchDexQuote(hop.dexDetails, receivedAmount);

        log.debug(
            "Swap execution fetched pre-OFT DEX quote",
            getSwapExecutionLogContext(latestSwap.id, {
                guid,
                amountReceived: receivedAmount.toString(),
                amountExpected: expectedAmount.toString(),
                quotedAmountOut: quote.trade.amountOut.toString(),
            }),
        );

        if (quote.trade.amountOut < expectedAmount) {
            log.warn("OFT received amount is less than expected", {
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
            latestSwap.oft.destinationAsset,
            gasAbstractionSigner,
        );
        const transferData = token.interface.encodeFunctionData("transfer", [
            routerAddress,
            receivedAmount,
        ]);
        const calls = [
            {
                to: getTokenAddress(latestSwap.oft.destinationAsset),
                value: "0",
                data: transferData,
            },
        ];

        log.info(
            "Swap execution broadcasting pre-OFT commitment lockup",
            getSwapExecutionLogContext(latestSwap.id, {
                guid,
                destinationAsset: latestSwap.oft.destinationAsset,
                commitmentAsset: latestSwap.assetSend,
                amountReceived: receivedAmount.toString(),
            }),
        );
        const tx = await router.executeAndLockERC20.populateTransaction(
            prefix0x("00".repeat(32)),
            getTokenAddress(latestSwap.assetSend),
            latestSwap.claimAddress,
            gasAbstractionSigner.address,
            getSwapTimeoutBlockHeight(latestSwap),
            encoded.calls.map((call) => ({
                target: call.to,
                value: call.value,
                callData: prefix0x(call.data),
            })),
        );
        calls.push(tx);

        latestSwap.commitmentLockupTxHash = await sendPopulatedTransaction(
            GasAbstractionType.Signer,
            gasAbstractionSigner,
            calls,
        );
        latestSwap.commitmentSignatureSubmitted = false;
        await persistSwap(latestSwap);
        log.info(
            "Swap execution persisted commitment lockup transaction",
            getSwapExecutionLogContext(latestSwap.id, {
                commitmentLockupTxHash: latestSwap.commitmentLockupTxHash,
            }),
        );
        queueRelevantTasks(latestSwap);
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

        if (needsPreOftLockup(currentSwap)) {
            void runTask(currentSwap.id, "pre-oft", async (storedSwap) => {
                await executePreOftLockup(storedSwap);
            });
        }

        if (needsCommitmentPost(currentSwap)) {
            void runTask(currentSwap.id, "commitment", async (storedSwap) => {
                const commitmentAsset = getCommitmentChainAsset(storedSwap);
                const transactionSigner =
                    storedSwap.oft?.position === OftPosition.Pre
                        ? getGasAbstractionSigner(
                              storedSwap.oft.destinationAsset,
                          )
                        : storedSwap.gasAbstraction ===
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
                    preimageHash: await getSwapPreimageHash(storedSwap),
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
