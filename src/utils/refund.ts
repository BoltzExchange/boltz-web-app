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
import { deriveKeyFn } from "../context/Global";
import secp from "../lazy/secp";
import {
    TransactionInterface,
    broadcastTransaction,
    getFeeEstimations,
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
import { ChainSwap, SubmarineSwap } from "./swapCreator";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

const refundTaproot = async <T extends TransactionInterface>(
    swap: SubmarineSwap | ChainSwap,
    lockupTx: TransactionInterface,
    privateKey: ECPairInterface,
    decodedAddress: DecodedAddress,
    feePerVbyte: number,
    timeoutBlockHeight: number,
    cooperative: boolean = true,
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
    const musig = await createMusig(privateKey, boltzPublicKey);
    const tweakedKey = tweakMusig(swap.assetSend, musig, swapTree.tree);

    const swapOutput = detectSwap(tweakedKey, lockupTx);

    const details = [
        {
            ...swapOutput,
            cooperative,
            swapTree,
            keys: privateKey,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap, true),
            internalKey: musig.getAggregatedPublicKey(),
        },
    ] as (RefundDetails & { blindingPrivateKey: Buffer })[];

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
        const boltzSig = await getPartialRefundSignature(
            swap.id,
            swap.type,
            Buffer.from(musig.getPublicNonce()),
            refundTx,
            0,
        );
        musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
        musig.initializeSession(
            hashForWitnessV1(
                swap.assetSend,
                getNetwork(swap.assetSend),
                details,
                refundTx,
                0,
            ),
        );
        musig.signPartial();
        musig.addPartial(boltzPublicKey, boltzSig.signature);

        refundTx.ins[0].witness = [musig.aggregatePartials()];

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
                lockupTx,
                privateKey,
                decodedAddress,
                feePerVbyte,
                timeoutBlockHeight,
                false,
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
    transactionToRefund: { hex: string; timeoutBlockHeight: number },
    cooperative: boolean,
    externalBroadcast: boolean,
): Promise<T> => {
    log.info(`Refunding swap ${swap.id}: `, swap);

    const output = decodeAddress(swap.assetSend, refundAddress);

    const feePerVbyte = (await getFeeEstimations())[swap.assetSend];

    const lockupTransaction = getTransaction(swap.assetSend).fromHex(
        transactionToRefund.hex,
    );
    const privateKey = parsePrivateKey(
        deriveKey,
        swap.refundPrivateKeyIndex,
        swap.refundPrivateKey,
    );

    let refundTransaction: Awaited<ReturnType<typeof refundTaproot>>;

    if (swap.version === OutputType.Taproot) {
        refundTransaction = await refundTaproot(
            swap,
            lockupTransaction,
            privateKey,
            output,
            feePerVbyte,
            transactionToRefund.timeoutBlockHeight,
            cooperative,
        );
    } else {
        // Initialize the secp256k1-zkp library for blinding
        await secp.get();
        const redeemScript = Buffer.from(
            (swap as unknown as { redeemScript: string }).redeemScript,
            "hex",
        );
        log.debug("redeemScript", redeemScript);
        const swapOutput = detectSwap(redeemScript, lockupTransaction);
        log.debug("swapOutput", swapOutput);

        const constructRefundTransaction = getConstructRefundTransaction(
            swap.assetSend,
            swap.assetSend === LBTC && output.blindingKey === undefined,
        );
        refundTransaction = {
            transaction: constructRefundTransaction(
                [
                    {
                        ...swapOutput,
                        txHash: lockupTransaction.getHash(),
                        redeemScript: redeemScript,
                        keys: privateKey,
                        blindingPrivateKey: parseBlindingKey(swap, true),
                    } as RefundDetails & LiquidRefundDetails,
                ],
                output.script,
                transactionToRefund.timeoutBlockHeight,
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
