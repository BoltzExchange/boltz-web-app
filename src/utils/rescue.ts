import { hex } from "@scure/base";
import { SwapTreeSerializer, detectSwap } from "boltz-core";
import {
    assetRescueBroadcast,
    assetRescueSetup,
    getLockupTransaction,
} from "boltz-swaps/client";
import { SwapType, arbitrumChainId } from "boltz-swaps/types";
import {
    type RefundResult,
    type TransactionInterface,
    type UtxoAsset,
    type UtxoNetwork,
    createMusig,
    getTransaction,
    refundUtxos,
    tweakMusig,
    txToId,
} from "boltz-swaps/utxo";
import log from "loglevel";

import { config } from "../config";
import {
    type AssetType,
    ETH,
    LBTC,
    type RefundableAssetType,
    type blockChainsAssets,
    refundableAssets,
} from "../consts/Assets";
import {
    swapStatusFailed,
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import type { deriveKeyFn } from "../context/Global";
import {
    blockTimeMinutes,
    broadcastTransaction,
    getBlockTipHeight,
    getSwapUTXOs,
} from "./blockchain";
import type { ECKeys } from "./ecpair";
import { formatError } from "./errors";
import { getFeeEstimationsFailover } from "./fees";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import {
    type ChainSwap,
    type ReverseSwap,
    type SomeSwap,
    type SubmarineSwap,
    isEvmSwap,
} from "./swapCreator";

export enum RescueAction {
    Successful = "successful",
    Claim = "claim",
    Refund = "refund",
    Pending = "pending",
    Failed = "failed",
}

export const enum RefundType {
    Cooperative = "cooperative",
    Uncooperative = "uncooperative",
    AssetRescue = "assetRescue",
}

export const RescueNoAction = [
    RescueAction.Successful,
    RescueAction.Pending,
    RescueAction.Failed,
];

export const isSwapClaimable = ({
    status,
    type,
    zeroConf,
    swap = undefined,
    includeSuccess = false,
}: {
    status: string;
    type: SwapType;
    swap?: SomeSwap;
    zeroConf: boolean;
    includeSuccess?: boolean;
}) => {
    if (swap !== undefined && isEvmSwap(swap)) {
        return false;
    }

    switch (type) {
        case SwapType.Reverse: {
            const statuses = [swapStatusPending.TransactionConfirmed];

            if (zeroConf) {
                statuses.push(swapStatusPending.TransactionMempool);
            }

            if (includeSuccess) {
                statuses.push(swapStatusSuccess.InvoiceSettled);
            }

            return statuses.includes(status);
        }
        case SwapType.Chain: {
            const statuses = [swapStatusPending.TransactionServerConfirmed];

            if (zeroConf) {
                statuses.push(swapStatusPending.TransactionServerMempool);
            }

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
        [SwapType.Dex]: () => Number.MAX_SAFE_INTEGER, // TODO: fix that
    };

    return currentBlockHeight >= swapTimeoutBlockHeight[swap.type]();
};

const refundTaproot = (
    swap: SubmarineSwap | ChainSwap,
    transactionsToRefund: { hex: string; timeoutBlockHeight?: number }[],
    privateKey: ECKeys,
    refundAddress: string,
    feePerVbyte: number,
    cooperative: boolean,
    nLockTime: number,
): Promise<RefundResult> => {
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
    const blindingKey = parseBlindingKey(swap, true);

    // Cooperative co-signing, per-input signing and the uncooperative fallback
    // all live in the SDK primitive now.
    return refundUtxos({
        id: swap.id,
        swapType: swap.type,
        asset: swap.assetSend as UtxoAsset,
        network: config.network as UtxoNetwork,
        swapTree: lockupTree,
        claimPublicKey: theirPublicKey,
        refundKeys: privateKey,
        lockups: transactionsToRefund.map((tx) => ({
            lockupTxHex: tx.hex,
            timeoutBlockHeight: tx.timeoutBlockHeight ?? nLockTime,
        })),
        refundAddress,
        blindingKey: blindingKey ? hex.encode(blindingKey) : undefined,
        feePerVbyte,
        nLockTime,
        cooperative,
    });
};

const broadcastRefund = async <T extends SubmarineSwap | ChainSwap>(
    swap: T,
    txConstructionResponse: Awaited<ReturnType<typeof refundTaproot>>,
): Promise<string> => {
    try {
        log.debug("Broadcasting refund transaction");
        const res = await broadcastTransaction(
            swap.assetSend,
            txConstructionResponse.transactionHex,
        );
        log.debug("Refund broadcast result", res);
        return res.id;
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

const assetRescueRefund = async <T extends SubmarineSwap | ChainSwap>(
    swap: T,
    privateKey: ECKeys,
    refundAddress: string,
    transactionsToRefund: TransactionInterface[],
) => {
    if (swap.assetSend !== LBTC) {
        throw new Error("Asset rescue refund is only supported for LBTC");
    }

    if (transactionsToRefund.length !== 1) {
        throw new Error("Asset rescue refund requires exactly one transaction");
    }
    const transaction = transactionsToRefund[0];

    const theirPublicKey =
        swap.type === SwapType.Submarine
            ? (swap as SubmarineSwap).claimPublicKey
            : (swap as ChainSwap).lockupDetails.serverPublicKey;
    const lockupTree =
        swap.type === SwapType.Submarine
            ? (swap as SubmarineSwap).swapTree
            : (swap as ChainSwap).lockupDetails.swapTree;

    const swapTree = SwapTreeSerializer.deserializeSwapTree(lockupTree);
    const boltzPublicKey = hex.decode(theirPublicKey);
    const keyAgg = createMusig(privateKey, boltzPublicKey);
    const tweaked = tweakMusig(swap.assetSend, keyAgg, swapTree.tree);

    const output = detectSwap(tweaked.aggPubkey, transaction);
    if (output === undefined) {
        throw new Error("could not detect swap output for rescue");
    }

    const setup = await assetRescueSetup(
        swap.assetSend,
        swap.id,
        txToId(transaction),
        output.vout,
        refundAddress,
    );

    const withMsg = tweaked.message(hex.decode(setup.musig.message));
    const withNonce = withMsg.generateNonce();

    const aggNonces = withNonce.aggregateNonces([
        [boltzPublicKey, hex.decode(setup.musig.pubNonce)],
    ]);
    const session = aggNonces.initializeSession();
    const signed = session.signPartial();

    const res = await assetRescueBroadcast(
        swap.assetSend,
        swap.id,
        withNonce.publicNonce,
        signed.ourPartialSignature,
    );
    log.info("Asset rescue broadcast result", res);

    return res.transactionId;
};

export const refund = async <T extends SubmarineSwap | ChainSwap>(
    deriveKey: deriveKeyFn,
    swap: T,
    refundAddress: string,
    transactionsToRefund: { hex: string; timeoutBlockHeight?: number }[],
    type: RefundType,
): Promise<string> => {
    log.info(`${type} refunding swap ${swap.id}: `, swap);

    const transactions = transactionsToRefund.map((transactionToRefund) =>
        getTransaction(swap.assetSend).fromHex(transactionToRefund.hex),
    );

    const privateKey = parsePrivateKey(
        deriveKey,
        swap.assetSend as AssetType,
        swap.refundPrivateKeyIndex,
        swap.refundPrivateKey,
    );

    if (type === RefundType.AssetRescue) {
        return await assetRescueRefund(
            swap,
            privateKey,
            refundAddress,
            transactions,
        );
    }

    const feePerVbyte = await getFeeEstimationsFailover(swap.assetSend);

    const validTimeouts = transactionsToRefund
        .filter(
            (tx): tx is typeof tx & { timeoutBlockHeight: number } =>
                typeof tx.timeoutBlockHeight === "number",
        )
        .map((tx) => tx.timeoutBlockHeight);
    const nLockTime = validTimeouts.length > 0 ? Math.max(...validTimeouts) : 0;

    const refundTransaction = await refundTaproot(
        swap,
        transactionsToRefund,
        privateKey,
        refundAddress,
        feePerVbyte,
        type === RefundType.Cooperative,
        nLockTime,
    );

    return broadcastRefund(swap, refundTransaction);
};

export const isRefundableSwapType = (swap: SomeSwap | null | undefined) =>
    swap !== null &&
    swap !== undefined &&
    [SwapType.Chain, SwapType.Submarine].includes(swap.type);

export const getRescuableUTXOs = async (currentSwap: SomeSwap) => {
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
        currentSwap.status !== undefined &&
        !Object.values(swapStatusFinal).includes(currentSwap.status)
    ) {
        return [lockupTx];
    }

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
        throw e;
    }
};

export const createRescueList = async (
    swaps: SomeSwap[],
    zeroConf: boolean,
) => {
    if (swaps.length === 0) {
        return [];
    }

    const currentBlockHeight = await getCurrentBlockHeight(swaps);

    return await Promise.all(
        swaps.map(async (swap) => {
            try {
                const utxos = isRefundableSwapType(swap)
                    ? await getRescuableUTXOs(swap)
                    : [];

                const status = swap.status ?? "";
                const blockHeight =
                    currentBlockHeight[swap.assetSend as RefundableAssetType];

                if (utxos.length === 0) {
                    if (Object.values(swapStatusSuccess).includes(status)) {
                        return { ...swap, action: RescueAction.Successful };
                    }
                    if (Object.values(swapStatusFailed).includes(status)) {
                        return { ...swap, action: RescueAction.Failed };
                    }
                }

                // Prioritize refunding for expired swaps with UTXOs
                if (
                    isRefundableSwapType(swap) &&
                    blockHeight !== undefined &&
                    hasSwapTimedOut(swap, blockHeight) &&
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
                        swap,
                        status,
                        type: swap.type,
                        zeroConf,
                    })
                ) {
                    return { ...swap, action: RescueAction.Claim };
                }

                const pendingFromUserPerspective = Object.values(
                    swapStatusPending,
                ).filter(
                    (status) =>
                        status !== swapStatusPending.TransactionClaimPending,
                );
                if (
                    isRefundableSwapType(swap) &&
                    !pendingFromUserPerspective.includes(status) &&
                    utxos.length > 0
                ) {
                    return {
                        ...swap,
                        action: RescueAction.Refund,
                        waitForSwapTimeout:
                            Object.values(swapStatusSuccess).includes(status),
                    };
                }

                return { ...swap, action: RescueAction.Pending };
            } catch (e) {
                log.error(
                    `error creating rescue list for swap ${swap.id}:`,
                    formatError(e),
                );
                return { ...swap, action: RescueAction.Successful };
            }
        }),
    );
};

export const getTimeoutEta = (
    asset: blockChainsAssets,
    timeoutBlockHeight: number,
    currentBlockHeight: number,
) => {
    // for assets on Arbitrum, we need to get timeout ETA from ETH L1
    const blockchainAsset =
        config.assets?.[asset]?.network?.chainId === arbitrumChainId
            ? ETH
            : asset;

    const blocksRemaining = timeoutBlockHeight - currentBlockHeight;
    const secondsRemaining =
        blocksRemaining * blockTimeMinutes[blockchainAsset] * 60;
    return Math.floor(Date.now() / 1000) + secondsRemaining;
};
