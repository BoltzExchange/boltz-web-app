import { hex } from "@scure/base";
import type { Transaction as BtcTransaction } from "@scure/btc-signer";
import type { RefundDetails } from "boltz-core";
import { OutputType, SwapTreeSerializer, detectSwap } from "boltz-core";
import type { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import { Transaction as LiquidTransaction } from "liquidjs-lib";
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
    swapStatusFailed,
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../consts/SwapStatus";
import type { deriveKeyFn } from "../context/Global";
import secp from "../lazy/secp";
import {
    blockTimeMinutes,
    getBlockTipHeight,
    getSwapUTXOs,
} from "./blockchain";
import {
    assetRescueBroadcast,
    assetRescueSetup,
    broadcastTransaction,
    getLockupTransaction,
    getPartialRefundSignature,
} from "./boltzClient";
import type { DecodedAddress, TransactionInterface } from "./compat";
import {
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
    setCooperativeWitness,
    txToHex,
    txToId,
} from "./compat";
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
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

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
    swapDate = undefined,
    backupImportTimestamp = undefined,
}: {
    status: string;
    type: SwapType;
    swap?: SomeSwap;
    zeroConf: boolean;
    includeSuccess?: boolean;
    swapDate?: number;
    backupImportTimestamp?: number;
}) => {
    if (swap !== undefined && isEvmSwap(swap)) {
        return false;
    }

    // When a backup is imported, we only auto-claim successful swaps that were created
    // after the import timestamp. This prevents attempting to claim swaps that may have
    // already been completed before the backup was created
    const swapCreatedAfterBackup: boolean =
        backupImportTimestamp === undefined ||
        (swapDate !== undefined && swapDate >= backupImportTimestamp);

    switch (type) {
        case SwapType.Reverse: {
            const statuses = [swapStatusPending.TransactionConfirmed];

            if (zeroConf) {
                statuses.push(swapStatusPending.TransactionMempool);
            }

            if (includeSuccess && swapCreatedAfterBackup) {
                statuses.push(swapStatusSuccess.InvoiceSettled);
            }

            return statuses.includes(status);
        }
        case SwapType.Chain: {
            const statuses = [swapStatusPending.TransactionServerConfirmed];

            if (zeroConf) {
                statuses.push(swapStatusPending.TransactionServerMempool);
            }

            if (includeSuccess && swapCreatedAfterBackup) {
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

const refundTaproot = async <T extends TransactionInterface>(
    swap: SubmarineSwap | ChainSwap,
    lockupTxs: TransactionInterface[],
    privateKey: ECKeys,
    decodedAddress: DecodedAddress,
    feePerVbyte: number,
    cooperative: boolean = true,
    timeoutBlockHeight?: number,
    cooperativeError?: string,
): Promise<{
    transaction: T;
    cooperativeError?: string;
}> => {
    log.info(
        `starting to refund swap ${swap.id} cooperatively: ${cooperative}`,
    );

    // Ensure secp256k1-zkp is initialized for Liquid transaction construction
    if (swap.assetSend === LBTC) {
        await secp.get();
    }

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
    let keyAgg = createMusig(privateKey, boltzPublicKey);
    const tweaked = tweakMusig(swap.assetSend, keyAgg, swapTree.tree);

    const details = lockupTxs.map((lockupTx) => {
        const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);
        return {
            ...swapOutput,
            cooperative,
            swapTree,
            privateKey: privateKey.privateKey,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey: parseBlindingKey(swap, true),
            internalKey: keyAgg.aggPubkey,
        } as unknown as RefundDetails & { blindingPrivateKey: Uint8Array };
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
        const inputCount =
            refundTx instanceof LiquidTransaction
                ? refundTx.ins.length
                : (refundTx as BtcTransaction).inputsLength;

        for (let index = 0; index < inputCount; index++) {
            // Create new musig instance to initialize a new session
            keyAgg = createMusig(privateKey, boltzPublicKey);

            const sigHash = hashForWitnessV1(
                swap.assetSend,
                getNetwork(swap.assetSend),
                details,
                refundTx,
                index,
            );

            const tweakedForSign = tweakMusig(
                swap.assetSend,
                keyAgg,
                swapTree.tree,
            );
            const withMsg = tweakedForSign.message(sigHash);
            const withNonce = withMsg.generateNonce();

            const boltzSig = await getPartialRefundSignature(
                swap.id,
                swap.type,
                withNonce.publicNonce,
                refundTx,
                index,
            );

            const aggNonces = withNonce.aggregateNonces([
                [boltzPublicKey, boltzSig.pubNonce],
            ]);
            const session = aggNonces.initializeSession();
            const signed = session.signPartial();
            const withBoltz = signed.addPartial(
                boltzPublicKey,
                boltzSig.signature,
            );

            setCooperativeWitness(
                refundTx,
                index,
                withBoltz.aggregatePartials(),
            );
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
): Promise<string> => {
    try {
        log.debug("Broadcasting refund transaction");
        const res = await broadcastTransaction(
            swap.assetSend,
            txToHex(txConstructionResponse.transaction),
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
        throw new Error("Asset rescue refund is only supported for L-BTC");
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

    const output = decodeAddress(swap.assetSend, refundAddress);

    const feePerVbyte = await getFeeEstimationsFailover(swap.assetSend);

    const validTimeouts = transactionsToRefund
        .filter((tx) => typeof tx.timeoutBlockHeight === "number")
        .map((tx) => tx.timeoutBlockHeight);
    const timeoutBlockHeight =
        validTimeouts.length > 0 ? Math.max(...validTimeouts) : undefined;

    let refundTransaction: Awaited<ReturnType<typeof refundTaproot>>;

    if (swap.version === OutputType.Taproot) {
        refundTransaction = await refundTaproot(
            swap,
            transactions,
            privateKey,
            output,
            feePerVbyte,
            type === RefundType.Cooperative,
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
                transactionId: txToId(lockupTx),
                redeemScript: redeemScript,
                privateKey: privateKey.privateKey,
                blindingPrivateKey: parseBlindingKey(swap, true),
            } as unknown as RefundDetails & LiquidRefundDetails;
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

                if (utxos.length === 0) {
                    if (
                        Object.values(swapStatusSuccess).includes(swap.status)
                    ) {
                        return { ...swap, action: RescueAction.Successful };
                    }
                    if (Object.values(swapStatusFailed).includes(swap.status)) {
                        return { ...swap, action: RescueAction.Failed };
                    }
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
                        swap,
                        status: swap.status,
                        type: swap.type,
                        zeroConf,
                    })
                ) {
                    return { ...swap, action: RescueAction.Claim };
                }

                if (
                    isRefundableSwapType(swap) &&
                    !Object.values(swapStatusPending).includes(swap.status) &&
                    utxos.length > 0
                ) {
                    return {
                        ...swap,
                        action: RescueAction.Refund,
                        waitForSwapTimeout: Object.values(
                            swapStatusSuccess,
                        ).includes(swap.status),
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
    asset: RefundableAssetType,
    timeoutBlockHeight: number,
    currentBlockHeight: number,
) => {
    const blocksRemaining = timeoutBlockHeight - currentBlockHeight;
    const secondsRemaining = blocksRemaining * blockTimeMinutes[asset] * 60;
    return Math.floor(Date.now() / 1000) + secondsRemaining;
};
