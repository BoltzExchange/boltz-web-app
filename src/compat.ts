import zkp, {
    Ecc,
    Ecdh,
    Generator,
    Pedersen,
    RangeProof,
    SurjectionProof,
} from "@vulpemventures/secp256k1-zkp";
import { Transaction, address, networks } from "bitcoinjs-lib";
import {
    RefundDetails,
    TransactionOutput,
    constructClaimTransaction,
    constructRefundTransaction,
    targetFee,
} from "boltz-core";
import {
    LiquidRefundDetails,
    init,
    constructClaimTransaction as lcCT,
    constructRefundTransaction as lcRT,
} from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import {
    address as LiquidAddress,
    networks as LiquidNetworks,
    Transaction as LiquidTransaction,
    TxOutput as LiquidTransactionOutput,
    confidential,
} from "liquidjs-lib";

import { network } from "./config";
import { LBTC } from "./consts";

type LiquidTransactionOutputWithKey = LiquidTransactionOutput & {
    blindingPrivateKey: Buffer;
};

export let secp: {
    ecdh: Ecdh;
    ecc: Ecc;
    generator: Generator;
    pedersen: Pedersen;
    rangeproof: RangeProof;
    surjectionproof: SurjectionProof;
};
let confi: confidential.Confidential;

const setup = async () => {
    if (confi !== undefined) {
        return;
    }

    secp = await zkp();
    init(secp);
    confi = new confidential.Confidential(secp);
};

const getAddress = (asset: string): typeof address | typeof LiquidAddress => {
    if (asset === LBTC) {
        return LiquidAddress;
    } else {
        return address;
    }
};

const decodeAddress = (
    asset: string,
    addr: string,
): { script: Buffer; blindingKey?: Buffer } => {
    const address = getAddress(asset);

    if (asset === LBTC) {
        // This throws for unconfidential addresses -> fallback to output script decoding
        try {
            const decoded = (address as typeof LiquidAddress).fromConfidential(
                addr,
            );

            return {
                script: decoded.scriptPubKey,
                blindingKey: decoded.blindingKey,
            };
        } catch (e) {}
    }

    return {
        script: address.toOutputScript(addr, getNetwork(asset)),
    };
};

const getNetwork = (asset: string) => {
    if (asset === LBTC) {
        const liquidNet = network === "main" ? "liquid" : network;
        return LiquidNetworks[liquidNet];
    } else {
        return networks[network];
    }
};

const getTransaction = (asset: string) => {
    if (asset === LBTC) {
        return LiquidTransaction;
    } else {
        return Transaction;
    }
};

const getConstructClaimTransaction = (asset: string) => {
    return asset === LBTC ? lcCT : constructClaimTransaction;
};

const getConstructRefundTransaction = (asset: string) => {
    const fn = asset === LBTC ? lcRT : constructRefundTransaction;
    return (
        refundDetails: RefundDetails | LiquidRefundDetails,
        outputScript: Buffer,
        timeoutBlockHeight: number,
        feePerVbyte: number,
        isRbf: boolean,
        assetHash?: string,
        blindingKey?: Buffer,
    ) =>
        targetFee(feePerVbyte, (fee) =>
            fn(
                refundDetails as any,
                outputScript,
                timeoutBlockHeight,
                fee,
                isRbf,
                assetHash,
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
    getAddress,
    getNetwork,
    decodeAddress,
    getTransaction,
    getOutputAmount,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
};
