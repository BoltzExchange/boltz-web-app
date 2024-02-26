import zkp, { Secp256k1ZKP } from "@vulpemventures/secp256k1-zkp";
import { Transaction } from "bitcoinjs-lib";
import {
    ClaimDetails,
    RefundDetails,
    TransactionOutput,
    constructClaimTransaction,
    constructRefundTransaction,
    targetFee,
} from "boltz-core";
import {
    LiquidClaimDetails,
    LiquidRefundDetails,
    init,
    constructClaimTransaction as lcCT,
    constructRefundTransaction as lcRT,
} from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import {
    Transaction as LiquidTransaction,
    TxOutput as LiquidTransactionOutput,
    confidential,
} from "liquidjs-lib";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "../../consts";

type LiquidTransactionOutputWithKey = LiquidTransactionOutput & {
    blindingPrivateKey?: Buffer;
};

export let secp: Secp256k1ZKP;
let confi: confidential.Confidential;

const setup = async () => {
    if (confi !== undefined) {
        return;
    }

    secp = await zkp();
    init(secp);
    confi = new confidential.Confidential(secp);
};

const getTransaction = (asset: string) => {
    if (asset === LBTC) {
        return LiquidTransaction;
    } else {
        return Transaction;
    }
};

const getConstructClaimTransaction = (asset: string) => {
    return (
        utxos: ClaimDetails[] | LiquidClaimDetails[],
        destinationScript: Buffer,
        fee: number,
        isRbf?: boolean,
        liquidNetwork?: LiquidNetwork,
        blindingKey?: Buffer,
    ) => {
        if (asset === LBTC) {
            return lcCT(
                utxos as LiquidClaimDetails[],
                destinationScript,
                fee,
                isRbf,
                liquidNetwork,
                blindingKey,
            );
        } else {
            return constructClaimTransaction(
                utxos as ClaimDetails[],
                destinationScript,
                fee,
                isRbf,
            );
        }
    };
};

const getConstructRefundTransaction = (asset: string) => {
    const fn = asset === LBTC ? lcRT : constructRefundTransaction;
    return (
        refundDetails: RefundDetails[] | LiquidRefundDetails[],
        outputScript: Buffer,
        timeoutBlockHeight: number,
        feePerVbyte: number,
        isRbf: boolean,
        liquidNetwork?: LiquidNetwork,
        blindingKey?: Buffer,
    ) =>
        targetFee(feePerVbyte, (fee) =>
            fn(
                refundDetails as any[],
                outputScript,
                timeoutBlockHeight,
                fee,
                isRbf,
                liquidNetwork,
                blindingKey,
            ),
        );
};

const getOutputAmount = (
    asset: string,
    output: TransactionOutput | LiquidTransactionOutputWithKey,
): number => {
    if (asset !== LBTC) {
        return (output as TransactionOutput).value;
    }

    output = output as LiquidTransactionOutputWithKey;

    if (output.rangeProof?.length !== 0) {
        const unblinded = confi.unblindOutputWithKey(
            output,
            output.blindingPrivateKey,
        );
        return Number(unblinded.value);
    } else {
        return confidential.confidentialValueToSatoshi(output.value);
    }
};

export {
    setup,
    getTransaction,
    getOutputAmount,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
    LiquidTransactionOutputWithKey,
};
