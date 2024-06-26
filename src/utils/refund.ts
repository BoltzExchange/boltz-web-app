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
    setup,
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
    const musig = createMusig(privateKey, boltzPublicKey);
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
    const claimTx = constructRefundTransaction(
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
            transaction: claimTx as T,
        };
    }

    try {
        const boltzSig = await getPartialRefundSignature(
            swap.assetSend,
            swap.id,
            swap.type,
            Buffer.from(musig.getPublicNonce()),
            claimTx,
            0,
        );
        musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
        musig.initializeSession(
            hashForWitnessV1(
                swap.assetSend,
                getNetwork(swap.assetSend),
                details,
                claimTx,
                0,
            ),
        );
        musig.signPartial();
        musig.addPartial(boltzPublicKey, boltzSig.signature);

        claimTx.ins[0].witness = [musig.aggregatePartials()];

        return {
            transaction: claimTx as T,
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
): Promise<T> => {
    try {
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
        const errorMsg = typeof e.json === "function" ? await e.json() : e;
        if (errorMsg.error === undefined) {
            throw e;
        }

        // When the uncooperative refund transaction is not ready to be broadcast yet
        // (= non-final) and the cooperative spend has been tried but failed,
        // throw the error of the cooperative spend
        throw errorMsg.error === "non-final" &&
            txConstructionResponse.cooperativeError !== undefined
            ? txConstructionResponse.cooperativeError
            : errorMsg.error;
    }
};

export const refund = async <T extends SubmarineSwap | ChainSwap>(
    swap: T,
    refundAddress: string,
    transactionToRefund: { hex: string; timeoutBlockHeight: number },
    cooperative: boolean = true,
): Promise<T> => {
    log.info(`refunding swap ${swap.id}: `, swap);

    await setup();

    const output = decodeAddress(swap.assetSend, refundAddress);

    const feePerVbyte = (await getFeeEstimations(swap.assetSend))[
        swap.assetSend
    ];

    const lockupTransaction = getTransaction(swap.assetSend).fromHex(
        transactionToRefund.hex,
    );
    const privateKey = parsePrivateKey(swap.refundPrivateKey);

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
        const redeemScript = Buffer.from((swap as any).redeemScript, "hex");
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

    return broadcastRefund(swap, refundTransaction);
};
