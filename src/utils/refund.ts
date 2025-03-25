import {
    OutputType,
    RefundDetails,
    SwapTreeSerializer,
    detectSwap,
} from "boltz-core";
import { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import { ECPairInterface } from "ecpair";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { LBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { swapStatusPending } from "../consts/SwapStatus";
import { deriveKeyFn } from "../context/Global";
import secp from "../lazy/secp";
import { getSwapUTXOs } from "./blockchain";
import {
    LockupTransaction,
    TransactionInterface,
    broadcastTransaction,
    getFeeEstimations,
    getLockupTransaction,
    getPartialRefundSignature,
} from "./boltzClient";
import {
    DecodedAddress,
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
} from "./compat";
import { formatError } from "./errors";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import { ChainSwap, SomeSwap, SubmarineSwap, isRsk } from "./swapCreator";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

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

        const errorMsg = typeof e.json === "function" ? await e.json() : e;
        log.warn(
            "Cooperative Taproot refund failed because",
            formatError(errorMsg),
        );

        try {
            return await refundTaproot(
                swap,
                lockupTxs,
                privateKey,
                decodedAddress,
                feePerVbyte,
                false,
                timeoutBlockHeight,
                formatError(errorMsg),
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
    externalBroadcast: boolean,
): Promise<T> => {
    try {
        log.debug("Broadcasting refund transaction");
        const res = await broadcastTransaction(
            swap.assetSend,
            txConstructionResponse.transaction.toHex(),
            externalBroadcast,
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
    externalBroadcast: boolean,
): Promise<T> => {
    log.info(`Refunding swap ${swap.id}: `, swap);

    const output = decodeAddress(swap.assetSend, refundAddress);

    const feePerVbyte = (await getFeeEstimations())[swap.assetSend];

    const transactions = transactionsToRefund.map((transactionToRefund) =>
        getTransaction(swap.assetSend).fromHex(transactionToRefund.hex),
    );

    // We only have timeoutBlockHeight for the lockup transaction
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

    return broadcastRefund(swap, refundTransaction, externalBroadcast);
};

export const isSwapRefundable = (swap: SomeSwap) =>
    !isRsk(swap) &&
    [SwapType.Chain, SwapType.Submarine].includes(swap.type) &&
    ![...Object.values(swapStatusPending)].includes(swap.status);

export const getRefundableUTXOs = async (currentSwap: SomeSwap) => {
    const mergeLockupWithUTXOs = (
        lockupTx: LockupTransaction,
        utxos: Pick<LockupTransaction, "hex">[],
    ) => {
        const isLockupTx = (utxo: Pick<LockupTransaction, "hex">) =>
            utxo.hex === lockupTx.hex;

        if (utxos.some(isLockupTx)) {
            // If the utxo is also a lockup tx, prefer using it
            return [lockupTx, ...utxos.filter((tx) => !isLockupTx(tx))];
        }

        return utxos;
    };

    if (!isSwapRefundable(currentSwap)) {
        log.warn(`swap ${currentSwap.id} is not refundable`);
        return [];
    }

    const [lockupTxResult, utxosResult] = await Promise.allSettled([
        getLockupTransaction(currentSwap.id, currentSwap.type),
        getSwapUTXOs(currentSwap as ChainSwap | SubmarineSwap),
    ]);

    const lockupTx =
        lockupTxResult.status === "fulfilled" ? lockupTxResult.value : null;
    const utxos = utxosResult.status === "fulfilled" ? utxosResult.value : null;

    if (lockupTx && utxos) {
        return mergeLockupWithUTXOs(lockupTx, utxos);
    }
    if (lockupTx && !utxos) {
        return [lockupTx];
    }
    if (!lockupTx && utxos) {
        return utxos;
    }

    // if both requests were "rejected"
    log.error("failed to fetch utxo data for swap: ", currentSwap.id);
    return [];
};

export const createRefundList = async (swaps: SomeSwap[]) => {
    return await Promise.all(
        swaps.map(async (swap) => {
            try {
                const utxos = await getRefundableUTXOs(swap);

                if (utxos.length > 0) {
                    return swap;
                }

                return { ...swap, disabled: true };
            } catch (e) {
                log.error("error creating refund list: ", e.stack);
                return { ...swap, disabled: true };
            }
        }),
    );
};
