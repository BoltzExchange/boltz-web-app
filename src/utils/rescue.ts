import type { RefundDetails } from "boltz-core";
import { OutputType, SwapTreeSerializer, detectSwap } from "boltz-core";
import type { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import type { ECPairInterface } from "ecpair";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import {
    type AssetType,
    LBTC,
    type RefundableAssetType,
    refundableAssets,
} from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import {
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import type { deriveKeyFn } from "../context/Global";
import secp from "../lazy/secp";
import { getBlockTipHeight, getSwapUTXOs } from "./blockchain";
import type { TransactionInterface } from "./boltzClient";
import {
    broadcastTransaction,
    getLockupTransaction,
    getPartialRefundSignature,
} from "./boltzClient";
import type { DecodedAddress } from "./compat";
import {
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
} from "./compat";
import { formatError } from "./errors";
import { getFeeEstimationsFailover } from "./fees";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "./swapCreator";
import { isRsk } from "./swapCreator";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

export enum RescueAction {
    None = "none",
    Claim = "claim",
    Refund = "refund",
    Pending = "pending",
}

export const RescueNoAction = [RescueAction.None, RescueAction.Pending];

export const isSwapClaimable = ({
    status,
    type,
    includeSuccess = false,
}: {
    status: string;
    type: SwapType;
    includeSuccess?: boolean;
}) => {
    switch (type) {
        case SwapType.Reverse: {
            const statuses = [
                swapStatusPending.TransactionConfirmed,
                swapStatusPending.TransactionMempool,
            ];

            if (includeSuccess) {
                statuses.push(swapStatusSuccess.InvoiceSettled);
            }

            return statuses.includes(status);
        }
        case SwapType.Chain: {
            const statuses = [
                swapStatusPending.TransactionServerConfirmed,
                swapStatusPending.TransactionServerMempool,
            ];

            if (includeSuccess) {
                statuses.push(swapStatusSuccess.TransactionClaimed);
            }

            return statuses.includes(status);
        }
        default:
            return false;
    }
};

export const hasSwapTimedOut = (swap: SomeSwap, currentBlockHeight: number) => {
    if (typeof currentBlockHeight !== "number") {
        return false;
    }

    const swapTimeoutBlockHeight: Record<SwapType, () => number> = {
        [SwapType.Chain]: () =>
            (swap as ChainSwap).lockupDetails.timeoutBlockHeight,
        [SwapType.Reverse]: () => (swap as ReverseSwap).timeoutBlockHeight,
        [SwapType.Submarine]: () => (swap as SubmarineSwap).timeoutBlockHeight,
    };

    return currentBlockHeight >= swapTimeoutBlockHeight[swap.type]();
};

const refundTaproot = async <T extends TransactionInterface>(
    swap: SubmarineSwap | ChainSwap,
    lockupTxs: TransactionInterface[],
    privateKey: ECPairInterface,
    decodedAddress: DecodedAddress,
    feePerVbyte: number,
    cooperative: boolean = true,
    timeoutBlockHeight?: number,
    // Keep the error of the cooperative refund to show a nice error reason in case the
    // uncooperative transaction is not ready to be broadcast yet
    cooperativeError?: string,
): Promise<{
    transaction: T;
    cooperativeError?: string;
}> => {
    log.info(
        `starting to refund swap ${swap.id} cooperatively: ${cooperative}`,
    );
    const theirPublicKey =
        swap.type === SwapType.Submarine
            ? (swap as SubmarineSwap).claimPublicKey
            : (swap as ChainSwap).lockupDetails.serverPublicKey;
    const lockupTree =
        swap.type === SwapType.Submarine
            ? (swap as SubmarineSwap).swapTree
            : (swap as ChainSwap).lockupDetails.swapTree;

    const swapTree = SwapTreeSerializer.deserializeSwapTree(lockupTree);
    const boltzPublicKey = Buffer.from(theirPublicKey, "hex");
    let musig = await createMusig(privateKey, boltzPublicKey);
    const tweakedKey = tweakMusig(swap.assetSend, musig, swapTree.tree);

    const details = lockupTxs.map((lockupTx) => {
        const swapOutput = detectSwap(tweakedKey, lockupTx);
        return {
            ...swapOutput,
            cooperative,
            swapTree,
            keys: privateKey,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap, true),
            internalKey: musig.getAggregatedPublicKey(),
        } as RefundDetails & { blindingPrivateKey: Buffer };
    });

    const constructRefundTransaction = getConstructRefundTransaction(
        swap.assetSend,
        swap.assetSend === LBTC && decodedAddress.blindingKey === undefined,
    );
    const refundTx = constructRefundTransaction(
        details,
        decodedAddress.script,
        cooperative ? 0 : timeoutBlockHeight,
        feePerVbyte,
        true,
        getNetwork(swap.assetSend) as LiquidNetwork,
        decodedAddress.blindingKey,
    );

    if (!cooperative) {
        return {
            cooperativeError,
            transaction: refundTx as T,
        };
    }

    try {
        for (const [index, input] of refundTx.ins.entries()) {
            // Create new musig instance to initialize a new session
            musig = await createMusig(privateKey, boltzPublicKey);
            const boltzSig = await getPartialRefundSignature(
                swap.id,
                swap.type,
                Buffer.from(musig.getPublicNonce()),
                refundTx,
                index,
            );
            musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
            tweakMusig(swap.assetSend, musig, swapTree.tree);
            musig.initializeSession(
                hashForWitnessV1(
                    swap.assetSend,
                    getNetwork(swap.assetSend),
                    details,
                    refundTx,
                    index,
                ),
            );
            musig.signPartial();
            musig.addPartial(boltzPublicKey, boltzSig.signature);

            input.witness = [musig.aggregatePartials()];
        }
        return {
            transaction: refundTx as T,
        };
    } catch (e) {
        if (!cooperative) {
            throw e;
        }

        log.warn("Cooperative Taproot refund failed because", formatError(e));

        try {
            return await refundTaproot(
                swap,
                lockupTxs,
                privateKey,
                decodedAddress,
                feePerVbyte,
                false,
                timeoutBlockHeight,
                formatError(e),
            );
        } catch (uncoopError) {
            log.warn(
                `Uncooperative Taproot refund failed because`,
                formatError(uncoopError),
            );
            throw uncoopError;
        }
    }
};

const broadcastRefund = async <T extends SubmarineSwap | ChainSwap>(
    swap: T,
    txConstructionResponse: Awaited<ReturnType<typeof refundTaproot>>,
): Promise<T> => {
    try {
        log.debug("Broadcasting refund transaction");
        const res = await broadcastTransaction(
            swap.assetSend,
            txConstructionResponse.transaction.toHex(),
        );
        log.debug("Refund broadcast result", res);
        if (res.id) {
            swap.refundTx = res.id;
        }
        return swap;
    } catch (e) {
        // When the uncooperative refund transaction is not ready to be broadcast yet
        // (= non-final) and the cooperative spend has been tried but failed,
        // throw the error of the cooperative spend
        throw e === "non-final" &&
            txConstructionResponse.cooperativeError !== undefined
            ? txConstructionResponse.cooperativeError
            : e;
    }
};

export const refund = async <T extends SubmarineSwap | ChainSwap>(
    deriveKey: deriveKeyFn,
    swap: T,
    refundAddress: string,
    transactionsToRefund: { hex: string; timeoutBlockHeight?: number }[],
    cooperative: boolean,
): Promise<T> => {
    log.info(`Refunding swap ${swap.id}: `, swap);

    const output = decodeAddress(swap.assetSend, refundAddress);

    const feePerVbyte = await getFeeEstimationsFailover(swap.assetSend);

    const transactions = transactionsToRefund.map((transactionToRefund) =>
        getTransaction(swap.assetSend).fromHex(transactionToRefund.hex),
    );

    const timeoutBlockHeight = transactionsToRefund.find(
        (tx) => typeof tx.timeoutBlockHeight === "number",
    )?.timeoutBlockHeight;

    const privateKey = parsePrivateKey(
        deriveKey,
        swap.refundPrivateKeyIndex,
        swap.refundPrivateKey,
    );

    let refundTransaction: Awaited<ReturnType<typeof refundTaproot>>;

    if (swap.version === OutputType.Taproot) {
        refundTransaction = await refundTaproot(
            swap,
            transactions,
            privateKey,
            output,
            feePerVbyte,
            cooperative,
            timeoutBlockHeight,
        );
    } else {
        // Initialize the secp256k1-zkp library for blinding
        await secp.get();
        const redeemScript = Buffer.from(
            (swap as unknown as { redeemScript: string }).redeemScript,
            "hex",
        );
        log.debug("redeemScript", redeemScript);
        const details = transactions.map((lockupTx) => {
            const swapOutput = detectSwap(redeemScript, lockupTx);
            log.debug("swapOutput", swapOutput);
            return {
                ...swapOutput,
                txHash: lockupTx.getHash(),
                redeemScript: redeemScript,
                keys: privateKey,
                blindingPrivateKey: parseBlindingKey(swap, true),
            } as RefundDetails & LiquidRefundDetails;
        });

        const constructRefundTransaction = getConstructRefundTransaction(
            swap.assetSend,
            swap.assetSend === LBTC && output.blindingKey === undefined,
        );
        refundTransaction = {
            transaction: constructRefundTransaction(
                details,
                output.script,
                timeoutBlockHeight,
                feePerVbyte,
                true,
                swap.assetSend === LBTC
                    ? (getNetwork(swap.assetSend) as LiquidNetwork)
                    : undefined,
                output.blindingKey,
            ),
        };
    }

    return broadcastRefund(swap, refundTransaction);
};

export const isRefundableSwapType = (swap: SomeSwap) =>
    !isRsk(swap) && [SwapType.Chain, SwapType.Submarine].includes(swap.type);

export const getRefundableUTXOs = async (currentSwap: SomeSwap) => {
    const [lockupTxResult, utxosResult] = await Promise.allSettled([
        getLockupTransaction(currentSwap.id, currentSwap.type),
        getSwapUTXOs(currentSwap as ChainSwap | SubmarineSwap),
    ]);

    const lockupTx =
        lockupTxResult.status === "fulfilled" ? lockupTxResult.value : null;
    const utxos = utxosResult.status === "fulfilled" ? utxosResult.value : null;

    if (utxos) {
        if (utxos.length === 0) {
            return [];
        }
        return utxos;
    }

    // Fallback to lockup tx if 3rd party utxo data is not available and swap status is not final
    if (
        lockupTx &&
        !Object.values(swapStatusFinal).includes(currentSwap.status)
    ) {
        return [lockupTx];
    }

    // if both requests were "rejected"
    log.error("failed to fetch utxo data for swap:", currentSwap.id);
    return [];
};

export const getCurrentBlockHeight = async (swaps: SomeSwap[]) => {
    try {
        const assets: RefundableAssetType[] = Array.from(
            new Set<AssetType>(
                swaps.map((swap) => swap.assetSend as AssetType),
            ),
        ).filter((asset): asset is RefundableAssetType =>
            refundableAssets.includes(asset),
        );

        const blockHeights = await Promise.allSettled(
            assets.map(getBlockTipHeight),
        );

        const currentBlockHeight: Partial<Record<RefundableAssetType, number>> =
            {};

        blockHeights.forEach((res, index) => {
            const asset = assets[index];
            if (res.status === "rejected") {
                log.warn(`could not get block tip height for asset ${asset}`);
                return;
            }

            currentBlockHeight[asset] = Number(res.value);
        });

        return currentBlockHeight;
    } catch (e) {
        log.error("failed to fetch current block height:", formatError(e));
        return {};
    }
};

export const createRescueList = async (swaps: SomeSwap[]) => {
    if (swaps.length === 0) {
        return [];
    }

    const currentBlockHeight = await getCurrentBlockHeight(swaps);

    return await Promise.all(
        swaps.map(async (swap) => {
            try {
                const utxos = isRefundableSwapType(swap)
                    ? await getRefundableUTXOs(swap)
                    : [];

                if (
                    utxos.length === 0 &&
                    Object.values(swapStatusFinal).includes(swap.status)
                ) {
                    return { ...swap, action: RescueAction.None };
                }

                // Prioritize refunding for expired swaps with UTXOs
                if (
                    isRefundableSwapType(swap) &&
                    hasSwapTimedOut(swap, currentBlockHeight[swap.assetSend]) &&
                    utxos.length > 0
                ) {
                    return {
                        ...swap,
                        action: RescueAction.Refund,
                        timedOut: true,
                    };
                }

                if (
                    isSwapClaimable({
                        status: swap.status,
                        type: swap.type,
                    })
                ) {
                    return { ...swap, action: RescueAction.Claim };
                }

                if (
                    isRefundableSwapType(swap) &&
                    !Object.values(swapStatusPending).includes(swap.status) &&
                    utxos.length > 0
                ) {
                    return { ...swap, action: RescueAction.Refund };
                }

                return { ...swap, action: RescueAction.Pending };
            } catch (e) {
                log.error(
                    `error creating rescue list for swap ${swap.id}:`,
                    formatError(e),
                );
                return { ...swap, action: RescueAction.None };
            }
        }),
    );
};
