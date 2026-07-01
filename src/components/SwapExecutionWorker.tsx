import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import type { Connection } from "@solana/web3.js";
import { type BridgeDetails, bridgeRegistry } from "boltz-swaps/bridge";
import {
    addressToBytes32,
    cctpZeroBytes32,
    decodeCctpGuid,
    encodeCctpReceiveMessage,
    getCctpAttestation,
    isCctpNonceUsed,
    parseCctpBurnMessage,
} from "boltz-swaps/cctp";
import { encodeDexQuote, getCommitmentLockupDetails } from "boltz-swaps/client";
import {
    type AlchemyCall,
    assetAmountToSats,
    createAssetProvider,
    prefix0x,
    satsToAssetAmount,
    toAlchemyCall,
    waitForPreparedCallTransactionHash,
} from "boltz-swaps/evm";
import {
    emptyPreimageHash,
    isEmptyPreimageHash,
    postCommitmentSignatureForTransaction,
} from "boltz-swaps/evm/commitment";
import { createRouterContract } from "boltz-swaps/evm/contracts";
import {
    erc20Abi,
    erc20SwapAbi,
    routerAbi,
} from "boltz-swaps/generated/evm-abis";
import { calculateAmountOutMin } from "boltz-swaps/helper";
import { decodeInvoice } from "boltz-swaps/invoice";
import { getTronOftGuidFromTransactionInfo } from "boltz-swaps/oft";
import { getSolanaConnection } from "boltz-swaps/solana";
import {
    type TronTransactionInfo,
    getTronTransactionInfo,
    isFailedTronTransaction,
} from "boltz-swaps/tron";
import {
    BridgeKind,
    NetworkTransport,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import log from "loglevel";
import { createEffect, onCleanup, onMount } from "solid-js";
import {
    type Address,
    type Hash,
    type Hex,
    encodeFunctionData,
    getAbiItem,
    getAddress,
    isAddressEqual,
} from "viem";

import { config } from "../config";
import { USDC, getAssetBridge, getTokenAddress } from "../consts/Assets";
import { swapStatusPending } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { useModifySwap } from "../hooks/useModifySwap";
import { formatAssetAmountForLog } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { sendPopulatedTransaction } from "../utils/evmTransaction";
import { type ClaimQuote, fetchDexQuote } from "../utils/quoter";
import { appendCommitmentMatchMarker } from "../utils/swapMetadata";
import {
    type BridgeDetail,
    type ChainSwap,
    type DexDetail,
    GasAbstractionType,
    PreBridgeRecoveryStatus,
    type SomeSwap,
    type SubmarineSwap,
    getLockupGasAbstraction,
} from "../utils/swapCreator";

const retryIntervalMs = 1_000;
const taskRetryIntervalMs = 3_000;
const preBridgeDexQuoteAttempts = 3;
const preBridgeDexQuoteRetryDelayMs = 5_000;

// The backend rejects a commitment whose locked amount is below the swap's
// expected amount with "insufficient amount: <actual> < <expected>". The
// on-chain lockup is immutable, so this can never succeed on retry; treat it as
// terminal and offer a refund instead of looping forever.
const isInsufficientCommitmentAmountError = (error: unknown): boolean =>
    /insufficient amount/i.test(formatError(error));

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

const needsPreBridgeLockup = (
    swap: SomeSwap | null | undefined,
): swap is SomeSwap & {
    bridge: BridgeDetail & { txHash: string };
    dex: DexDetail;
} =>
    swap !== undefined &&
    swap !== null &&
    swap.bridge?.position === SwapPosition.Pre &&
    swap.bridge.txHash !== undefined &&
    swap.commitmentLockupTxHash === undefined &&
    (swap.bridge.recovery === undefined ||
        swap.bridge.recovery.status === PreBridgeRecoveryStatus.Retrying) &&
    isPendingCommitmentStatus(swap.status) &&
    swap.dex !== undefined &&
    swap.dex.position === SwapPosition.Pre &&
    swap.dex.hops.length > 0;

const usesManualCctpReceive = (
    swap: SomeSwap | null | undefined,
): swap is SomeSwap & { bridge: BridgeDetail } =>
    swap !== undefined &&
    swap !== null &&
    swap.bridge?.kind === BridgeKind.Cctp &&
    swap.bridge.position === SwapPosition.Pre &&
    swap.bridge.destinationAsset === USDC;

export const needsCommitmentPost = (
    swap: SomeSwap | null | undefined,
): swap is SomeSwap & { commitmentLockupTxHash: string } =>
    swap !== undefined &&
    swap !== null &&
    swap.commitmentLockupTxHash !== undefined &&
    !swap.commitmentSignatureSubmitted &&
    swap.commitmentRejection === undefined &&
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
          transactionHash: Hex;
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
    const { getSwap, getSwaps, slippage, pairs, fetchPairs } =
        useGlobalContext();
    const { swap } = usePayContext();
    const { getErc20Swap, getGasAbstractionSigner, signer } = useWeb3Signer();
    const modifySwap = useModifySwap();

    const runningTasks = new Set<string>();
    const scheduledRetries = new Map<string, number>();

    const persistCommitmentLockupTransaction = async (
        swapId: string,
        commitmentLockupTxHash: string,
        source: CommitmentLockupTransactionSource,
    ) => {
        const latestSwap = await modifySwap(swapId, (s) => {
            s.commitmentLockupTxHash = commitmentLockupTxHash;
            s.commitmentLockupCallId = undefined;
            s.commitmentSignatureSubmitted = false;
        });
        if (latestSwap === null) {
            return false;
        }

        log.info(
            `Swap execution persisted ${source} commitment lockup transaction`,
            getSwapExecutionLogContext(latestSwap.id, {
                commitmentLockupTxHash,
            }),
        );
        queueRelevantTasks(latestSwap);
        return true;
    };

    const persistPreBridgeDexQuoteBlock = async ({
        latestSwap,
        receivedAmount,
        receiveCall,
    }: {
        latestSwap: SomeSwap & {
            bridge: BridgeDetail & { txHash: string };
            dex: DexDetail;
        };
        receivedAmount: bigint;
        receiveCall?: AlchemyCall;
    }) => {
        log.warn(
            "Pre-bridge lockup blocked: DEX quote below required amount, " +
                "awaiting user recovery decision",
            getSwapExecutionLogContext(latestSwap.id, {
                asset: latestSwap.bridge.destinationAsset,
                amount: receivedAmount.toString(),
            }),
        );
        const recovery = {
            status: PreBridgeRecoveryStatus.Blocked,
            asset: latestSwap.bridge.destinationAsset,
            amount: receivedAmount.toString(),
            receiveCall,
        };
        await modifySwap(latestSwap.id, (s) => {
            if (s.bridge !== undefined) {
                s.bridge.recovery = recovery;
            }
        });
    };

    const clearPreBridgeRecovery = async (latestSwap: SomeSwap) => {
        if (latestSwap.bridge?.recovery === undefined) {
            return;
        }

        log.info(
            "Pre-bridge recovery cleared, proceeding with lockup",
            getSwapExecutionLogContext(latestSwap.id, {
                status: latestSwap.bridge.recovery.status,
            }),
        );
        await modifySwap(latestSwap.id, (s) => {
            if (s.bridge !== undefined) {
                s.bridge.recovery = undefined;
            }
        });
    };

    // A pre-bridge quote below the slippage threshold can still be locked when
    // the backend is able to renegotiate the shortfall. That is only possible
    // for chain swaps whose lockup amount still clears the pair minimum;
    // otherwise locking is pointless and the swap should block for a refund.
    const shouldLockBelowThresholdQuote = async (
        swap: SomeSwap,
        quoteAmountOut: bigint,
    ): Promise<boolean> => {
        if (swap.type !== SwapType.Chain) {
            return false;
        }

        const chainSwap = swap as ChainSwap;
        const lockupAmount = calculateAmountOutMin(quoteAmountOut, slippage());
        await fetchPairs();
        const minimal =
            pairs()?.[SwapType.Chain]?.[chainSwap.assetSend]?.[
                chainSwap.assetReceive
            ]?.limits.minimal;

        return (
            minimal === undefined ||
            assetAmountToSats(lockupAmount, chainSwap.assetSend) >=
                BigInt(minimal)
        );
    };

    const fetchPreBridgeDexQuote = async ({
        swap,
        swapId,
        guid,
        hop,
        receivedAmount,
        expectedAmount,
        receivedAsset,
        requiredAsset,
    }: {
        swap: SomeSwap;
        swapId: string;
        guid: string;
        hop: NonNullable<DexDetail["hops"][number]["dexDetails"]>;
        receivedAmount: bigint;
        expectedAmount: bigint;
        receivedAsset: string;
        requiredAsset: string;
    }): Promise<{ quote: ClaimQuote; shouldLock: boolean }> => {
        let lastQuote: ClaimQuote | undefined;
        const requiredAmount = calculateAmountOutMin(
            expectedAmount,
            slippage(),
        );
        for (let attempt = 1; attempt <= preBridgeDexQuoteAttempts; attempt++) {
            const quote = await fetchDexQuote(hop, receivedAmount);
            lastQuote = quote;

            const logContext = getSwapExecutionLogContext(swapId, {
                guid,
                attempt,
                attempts: preBridgeDexQuoteAttempts,
                receivedAsset,
                amountReceived: receivedAmount.toString(),
                requiredAsset,
                amountExpected: expectedAmount.toString(),
                amountRequired: requiredAmount.toString(),
                quotedAmountOut: quote.trade.amountOut.toString(),
                slippage: slippage(),
            });

            log.debug(
                "Swap execution fetched pre-bridge DEX quote",
                logContext,
            );

            if (quote.trade.amountOut >= requiredAmount) {
                return { quote, shouldLock: true };
            }

            log.warn("Pre-bridge DEX quote is below slippage threshold", {
                ...logContext,
                deficit: (requiredAmount - quote.trade.amountOut).toString(),
            });

            // Retrying only helps if the quote recovers above the slippage
            // threshold. If locking the shortfall is still viable, do it now
            // instead of burning the remaining attempts.
            if (
                await shouldLockBelowThresholdQuote(swap, quote.trade.amountOut)
            ) {
                log.info(
                    "Swap execution locking pre-bridge quote below threshold; lockup clears renegotiation minimum",
                    logContext,
                );
                return { quote, shouldLock: true };
            }

            if (attempt < preBridgeDexQuoteAttempts) {
                await sleep(preBridgeDexQuoteRetryDelayMs);
            }
        }

        if (lastQuote === undefined) {
            throw new Error("failed to fetch pre-bridge DEX quote");
        }

        return { quote: lastQuote, shouldLock: false };
    };

    const recoverPreBridgeCommitmentLockup = async (
        currentSwap: SomeSwap,
        receivedEvent: {
            blockNumber: number | bigint;
        },
        gasAbstractionSigner: {
            address: string;
        },
    ): Promise<PreBridgeCommitmentLockupRecoveryResult> => {
        const commitmentAsset = currentSwap.assetSend;
        const erc20Swap = getErc20Swap(commitmentAsset);
        const provider = createAssetProvider(commitmentAsset);
        const lockupLogs = await provider.getLogs({
            address: erc20Swap.address,
            event: getAbiItem({ abi: erc20SwapAbi, name: "Lockup" }),
            fromBlock: BigInt(receivedEvent.blockNumber),
            toBlock: "latest",
        });
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
            const {
                preimageHash,
                tokenAddress: lockupTokenAddress,
                claimAddress: lockupClaimAddress,
                refundAddress,
            } = event.args;
            const matches =
                typeof event.transactionHash === "string" &&
                preimageHash !== undefined &&
                lockupTokenAddress !== undefined &&
                lockupClaimAddress !== undefined &&
                refundAddress !== undefined &&
                isEmptyPreimageHash(preimageHash) &&
                isAddressEqual(lockupTokenAddress, getAddress(tokenAddress)) &&
                isAddressEqual(lockupClaimAddress, getAddress(claimAddress)) &&
                isAddressEqual(
                    refundAddress,
                    getAddress(gasAbstractionSigner.address),
                );

            if (!matches) {
                return [];
            }

            return [
                {
                    transactionHash: event.transactionHash,
                    logIndex: event.logIndex ?? 0,
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

    const requireCctpConfig = (asset: string) => {
        const bridge = getAssetBridge(asset);
        if (bridge?.kind !== BridgeKind.Cctp) {
            throw new Error(`missing CCTP config for asset ${asset}`);
        }
        return bridge.cctp;
    };

    const waitForManualCctpReceive = async (
        currentSwap: SomeSwap,
        guid: string,
        gasAbstractionSigner: { address: string },
    ) => {
        const decoded = decodeCctpGuid(guid);
        if (decoded === undefined) {
            throw new Error(`invalid CCTP guid: ${guid}`);
        }

        const bridge = currentSwap.bridge;
        if (bridge === undefined) {
            throw new Error("missing bridge details for CCTP receive");
        }

        const sourceConfig = requireCctpConfig(bridge.sourceAsset);
        const destinationConfig = requireCctpConfig(bridge.destinationAsset);
        if (decoded.sourceDomain !== sourceConfig.domain) {
            throw new Error("CCTP guid source domain does not match route");
        }

        const destinationProvider = createAssetProvider(
            bridge.destinationAsset,
        );
        const expectedMintRecipient = addressToBytes32(
            gasAbstractionSigner.address,
        ).toLowerCase();

        log.debug(
            "Swap execution waiting for manual CCTP attestation",
            getSwapExecutionLogContext(currentSwap.id, {
                guid,
                sourceAsset: bridge.sourceAsset,
                destinationAsset: bridge.destinationAsset,
            }),
        );

        while (true) {
            const latestSwap = await getSwap<SomeSwap>(currentSwap.id);
            if (!needsPreBridgeLockup(latestSwap)) {
                log.debug(
                    "Swap execution stopped waiting for manual CCTP attestation",
                    getSwapExecutionLogContext(currentSwap.id, { guid }),
                );
                return undefined;
            }

            const attestation = await getCctpAttestation(
                decoded.sourceDomain,
                decoded.sourceTxHash,
            );
            if (attestation === undefined) {
                await sleep(retryIntervalMs);
                continue;
            }

            const burn = parseCctpBurnMessage(attestation.message);
            if (
                burn.sourceDomain !== sourceConfig.domain ||
                burn.destinationDomain !== destinationConfig.domain
            ) {
                throw new Error("CCTP attestation domains do not match route");
            }
            if (burn.destinationCaller.toLowerCase() !== cctpZeroBytes32) {
                throw new Error("CCTP attestation is not permissionless");
            }
            if (burn.mintRecipient.toLowerCase() !== expectedMintRecipient) {
                throw new Error(
                    "CCTP attestation mint recipient does not match",
                );
            }

            const [fromBlock, nonceUsed] = await Promise.all([
                destinationProvider.getBlockNumber(),
                isCctpNonceUsed(
                    getAddress(destinationConfig.messageTransmitter),
                    destinationProvider,
                    burn.nonce,
                ),
            ]);
            log.info(
                "Swap execution found manual CCTP attestation",
                getSwapExecutionLogContext(currentSwap.id, {
                    guid,
                    amountReceived: formatAssetAmountForLog(
                        burn.amountReceived,
                        bridge.destinationAsset,
                    ),
                    sourceDomain: burn.sourceDomain,
                    destinationDomain: burn.destinationDomain,
                    nonceUsed,
                }),
            );

            return {
                receiveCall: nonceUsed
                    ? undefined
                    : ({
                          to: destinationConfig.messageTransmitter as Address,
                          value: "0",
                          data: encodeCctpReceiveMessage(
                              attestation.message,
                              attestation.attestation,
                          ),
                      } satisfies AlchemyCall),
                receivedEvent: {
                    guid,
                    srcEid: burn.sourceDomain,
                    toAddress: burn.mintRecipient,
                    amountReceivedLD: burn.amountReceived,
                    blockNumber: fromBlock,
                    logIndex: 0,
                },
            };
        }
    };

    const abandonFailedBridgeSend = async (
        swapId: string,
        sourceAsset: string,
        txHash: string,
    ) => {
        const latestSwap = await getSwap<SomeSwap>(swapId);
        if (
            latestSwap === undefined ||
            latestSwap === null ||
            latestSwap.bridge === undefined
        ) {
            return;
        }

        await modifySwap(swapId, (s) => {
            if (s.bridge === undefined) {
                return;
            }
            const bridge = { ...s.bridge };
            delete bridge.txHash;
            delete bridge.details;
            s.bridge = bridge;
        });
        log.warn(
            "Swap execution abandoning failed bridge send transaction",
            getSwapExecutionLogContext(swapId, {
                sourceAsset,
                txHash,
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

            const receipt = await sourceProvider
                .getTransactionReceipt({
                    hash: txHash as Hash,
                })
                .catch(() => null);
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

    const shouldAbandonSolanaBridgeSend = async (
        connection: Connection,
        txHash: string,
        details?: BridgeDetails,
    ): Promise<boolean> => {
        const signatureStatuses = await connection.getSignatureStatuses(
            [txHash],
            {
                searchTransactionHistory: true,
            },
        );
        const signatureStatus = signatureStatuses.value[0];

        if (signatureStatus?.err != null) {
            return true;
        }

        if (signatureStatus !== null) {
            return false;
        }

        const solana = details?.solana;
        if (solana === undefined) {
            return false;
        }

        const blockhashStatus = await connection.isBlockhashValid(
            solana.blockhash,
            {
                commitment: "confirmed",
            },
        );

        if (!blockhashStatus.value) {
            // To protect against a race where the tx was just included before the blockhash expired
            const signatureStatuses = await connection.getSignatureStatuses(
                [txHash],
                {
                    searchTransactionHistory: true,
                },
            );
            const signatureStatus = signatureStatuses.value[0];
            return signatureStatus === null || signatureStatus?.err != null;
        }

        return false;
    };

    const waitForSolanaBridgeSendConfirmation = async (
        swapId: string,
        sourceAsset: string,
        txHash: string,
        details?: BridgeDetails,
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

            if (
                await shouldAbandonSolanaBridgeSend(connection, txHash, details)
            ) {
                await abandonFailedBridgeSend(swapId, sourceAsset, txHash);
                return undefined;
            }

            await sleep(retryIntervalMs);
        }
    };

    const waitForTronBridgeSendConfirmation = async (
        swapId: string,
        sourceAsset: string,
        txHash: string,
    ): Promise<TronTransactionInfo | undefined> => {
        log.debug(
            "Swap execution waiting for Tron bridge send confirmation",
            getSwapExecutionLogContext(swapId, {
                sourceAsset,
                txHash,
            }),
        );

        while (true) {
            const currentSwap = await getSwap<SomeSwap>(swapId);
            if (!needsPreBridgeLockup(currentSwap)) {
                log.debug(
                    "Swap execution stopped waiting for Tron bridge send confirmation",
                    getSwapExecutionLogContext(swapId, {
                        sourceAsset,
                        txHash,
                    }),
                );
                return undefined;
            }

            const transactionInfo = await getTronTransactionInfo(
                sourceAsset,
                txHash,
            );
            if (transactionInfo !== undefined) {
                log.info(
                    "Swap execution found Tron bridge send confirmation",
                    getSwapExecutionLogContext(swapId, {
                        sourceAsset,
                        txHash,
                        blockNumber: transactionInfo.blockNumber,
                    }),
                );
                return transactionInfo;
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

        let lastSeenBlock: bigint | undefined;
        const reorgOverlapBlocks = 100n;

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

            const blockNumberSnapshot = await provider.getBlockNumber();
            const fromBlock =
                lastSeenBlock !== undefined
                    ? lastSeenBlock - reorgOverlapBlocks
                    : undefined;

            const receivedEvent = await bridgeDriver.getReceivedEventByGuid(
                contract,
                provider,
                bridgeContract.address,
                guid,
                fromBlock !== undefined ? { fromBlock } : undefined,
            );
            if (receivedEvent !== undefined) {
                log.info(
                    "Swap execution found bridge receive event",
                    getSwapExecutionLogContext(swapId, {
                        destinationAsset,
                        guid,
                        amountReceived: formatAssetAmountForLog(
                            receivedEvent.amountReceivedLD,
                            destinationAsset,
                        ),
                        logIndex: receivedEvent.logIndex,
                    }),
                );
                return receivedEvent;
            }

            lastSeenBlock = blockNumberSnapshot;
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

                if (sendReceipt.status === "reverted") {
                    await abandonFailedBridgeSend(
                        currentSwap.id,
                        currentSwap.bridge.sourceAsset,
                        currentSwap.bridge.txHash,
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
                        currentSwap.bridge.details,
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

                guid = bridgeDriver.deriveSolanaSentGuid({
                    sourceAsset: currentSwap.bridge.sourceAsset,
                    txHash: currentSwap.bridge.txHash,
                    logMessages,
                });
                break;
            }

            case NetworkTransport.Tron: {
                const transactionInfo = await waitForTronBridgeSendConfirmation(
                    currentSwap.id,
                    currentSwap.bridge.sourceAsset,
                    currentSwap.bridge.txHash,
                );
                if (transactionInfo === undefined) {
                    return;
                }

                if (isFailedTronTransaction(transactionInfo)) {
                    await abandonFailedBridgeSend(
                        currentSwap.id,
                        currentSwap.bridge.sourceAsset,
                        currentSwap.bridge.txHash,
                    );
                    return;
                }

                guid = getTronOftGuidFromTransactionInfo(
                    transactionInfo,
                    sourceBridge.address,
                );
                break;
            }

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
        const manualCctpReceive = usesManualCctpReceive(currentSwap)
            ? await waitForManualCctpReceive(
                  currentSwap,
                  guid,
                  getGasAbstractionSigner(currentSwap.bridge.destinationAsset),
              )
            : undefined;
        if (
            usesManualCctpReceive(currentSwap) &&
            manualCctpReceive === undefined
        ) {
            return;
        }

        const receivedEvent =
            manualCctpReceive?.receivedEvent ??
            (await waitForBridgeReceiptByGuid(
                currentSwap.id,
                currentSwap.bridge.destinationAsset,
                guid,
                currentSwap.bridge.sourceAsset,
            ));
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
        if (hop.dexDetails === undefined) {
            throw new Error("missing DEX details for pre-bridge hop");
        }
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
        const { quote, shouldLock } = await fetchPreBridgeDexQuote({
            swap: latestSwap,
            swapId: latestSwap.id,
            guid,
            hop: hop.dexDetails,
            receivedAmount,
            expectedAmount,
            receivedAsset: latestSwap.bridge.destinationAsset,
            requiredAsset: latestSwap.assetSend,
        });

        if (!shouldLock) {
            await persistPreBridgeDexQuoteBlock({
                latestSwap,
                receivedAmount,
                receiveCall: manualCctpReceive?.receiveCall,
            });
            return;
        }

        await clearPreBridgeRecovery(latestSwap);

        const router = createRouterContract(
            latestSwap.assetSend,
            gasAbstractionSigner,
        );
        const encoded = await encodeDexQuote(
            hop.dexDetails.chain,
            router.address,
            receivedAmount,
            calculateAmountOutMin(quote.trade.amountOut, slippage()),
            quote.trade.data,
        );

        const transferData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [router.address, receivedAmount],
        });
        const calls: AlchemyCall[] = [
            ...(manualCctpReceive?.receiveCall === undefined
                ? []
                : [manualCctpReceive.receiveCall]),
            {
                to: getTokenAddress(
                    latestSwap.bridge.destinationAsset,
                ) as Address,
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
                amountReceived: formatAssetAmountForLog(
                    receivedAmount,
                    latestSwap.bridge.destinationAsset,
                ),
            }),
        );
        const preBridgeClaimAddress =
            getPreBridgeCommitmentClaimAddress(latestSwap);
        if (preBridgeClaimAddress === undefined) {
            throw new Error("missing pre-bridge commitment claim address");
        }
        const tx = {
            to: router.address,
            data: appendCommitmentMatchMarker(
                encodeFunctionData({
                    abi: routerAbi,
                    functionName: "executeAndLockERC20",
                    args: [
                        emptyPreimageHash,
                        getAddress(getTokenAddress(latestSwap.assetSend)),
                        getAddress(preBridgeClaimAddress),
                        getAddress(gasAbstractionSigner.address),
                        BigInt(commitmentLockupDetails.timelock),
                        encoded.calls.map((call) => ({
                            target: getAddress(call.to),
                            value: BigInt(call.value),
                            callData: prefix0x(call.data),
                        })),
                    ],
                }),
                latestSwap.commitmentMatch?.id,
            ),
        };
        calls.push(toAlchemyCall(tx));

        try {
            latestSwap.commitmentLockupTxHash = await sendPopulatedTransaction(
                GasAbstractionType.Signer,
                gasAbstractionSigner,
                calls,
                {
                    alchemy: {
                        onPreparedCallId: async (callId) => {
                            await modifySwap(latestSwap.id, (s) => {
                                s.commitmentLockupCallId = callId;
                            });
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
                if (!needsCommitmentPost(storedSwap)) {
                    return;
                }
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
                try {
                    await postCommitmentSignatureForTransaction({
                        asset: storedSwap.assetSend,
                        commitmentAsset,
                        swapId: storedSwap.id,
                        preimageHash: getSwapPreimageHash(storedSwap),
                        commitmentTxHash:
                            storedSwap.commitmentLockupTxHash as Hash,
                        erc20Swap: getErc20Swap(commitmentAsset),
                        signer: transactionSigner,
                    });
                } catch (error) {
                    if (isInsufficientCommitmentAmountError(error)) {
                        const reason = formatError(error);
                        await modifySwap(storedSwap.id, (s) => {
                            s.commitmentRejection = { reason };
                        });
                        log.warn(
                            "Swap execution commitment permanently rejected; offering refund",
                            getSwapExecutionLogContext(storedSwap.id, {
                                reason,
                                commitmentLockupTxHash:
                                    storedSwap.commitmentLockupTxHash,
                            }),
                        );
                        return;
                    }
                    throw error;
                }

                await modifySwap(storedSwap.id, (s) => {
                    s.commitmentSignatureSubmitted = true;
                });
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
