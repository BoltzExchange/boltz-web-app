import { hex } from "@scure/base";
import {
    Address,
    Transaction as BtcTransaction,
    OutScript,
} from "@scure/btc-signer";
import type { TransactionOutput } from "@scure/btc-signer/psbt.js";
import type { BTC_NETWORK } from "@scure/btc-signer/utils.js";
import {
    type ClaimDetails,
    Networks,
    type RefundDetails,
    constructClaimTransaction,
    constructRefundTransaction,
    targetFee,
} from "boltz-core";
import {
    type LiquidClaimDetails,
    type LiquidRefundDetails,
    constructClaimTransaction as lcCT,
    constructRefundTransaction as lcRT,
} from "boltz-core/liquid";
import { Buffer } from "buffer";
import {
    address as LiquidAddress,
    networks as LiquidNetworks,
    Transaction as LiquidTransaction,
    type TxOutput as LiquidTransactionOutput,
    confidential,
} from "liquidjs-lib";

import { utxoSecp } from "./lazy.ts";
import { LBTC } from "./musig.ts";

type LiquidNetwork = (typeof LiquidNetworks)["liquid"];

export type UtxoNetwork = "mainnet" | "testnet" | "regtest";

export type LiquidTransactionOutputWithKey = LiquidTransactionOutput & {
    blindingPrivateKey?: Buffer;
};

export type DecodedAddress = { script: Uint8Array; blindingKey?: Buffer };

export type TransactionInterface = BtcTransaction | LiquidTransaction;

const getBtcNetwork = (network: UtxoNetwork): BTC_NETWORK => {
    switch (network) {
        case "mainnet":
            return Networks.bitcoin;
        case "testnet":
            return Networks.testnet;
        case "regtest":
            return Networks.regtest;
        default:
            throw new Error(`unknown network: ${String(network)}`);
    }
};

const getLiquidNetwork = (network: UtxoNetwork): LiquidNetwork => {
    const liquidNet = network === "mainnet" ? "liquid" : network;
    return LiquidNetworks[
        liquidNet as keyof typeof LiquidNetworks
    ] as LiquidNetwork;
};

export const getNetwork = (
    asset: string,
    network: UtxoNetwork,
): BTC_NETWORK | LiquidNetwork =>
    asset === LBTC ? getLiquidNetwork(network) : getBtcNetwork(network);

export const decodeAddress = (
    asset: string,
    addr: string,
    network: UtxoNetwork,
): DecodedAddress => {
    if (asset === LBTC) {
        const liquidNetwork = getLiquidNetwork(network);
        const script = LiquidAddress.toOutputScript(addr, liquidNetwork);

        // This throws for unconfidential addresses -> fall back to the script.
        try {
            const decoded = LiquidAddress.fromConfidential(addr);
            return { script, blindingKey: decoded.blindingKey };
        } catch {
            /* unconfidential address */
        }

        return { script };
    }

    const btcAddr = Address(getBtcNetwork(network));
    const decoded = btcAddr.decode(addr);
    if (decoded === undefined) {
        throw new Error(`could not decode address: ${addr}`);
    }
    return { script: OutScript.encode(decoded) };
};

export const getTransaction = (asset: string) => {
    if (asset === LBTC) {
        return {
            fromHex: (hexStr: string) => LiquidTransaction.fromHex(hexStr),
        };
    }
    return {
        fromHex: (hexStr: string) =>
            BtcTransaction.fromRaw(hex.decode(hexStr), {
                allowUnknownOutputs: true,
                allowUnknownInputs: true,
            }),
    };
};

export const getConstructClaimTransaction = (asset: string) => {
    return (
        utxos: ClaimDetails[] | LiquidClaimDetails[],
        destinationScript: Uint8Array,
        fee: number,
        isRbf?: boolean,
        liquidNetwork?: LiquidNetwork,
        blindingKey?: Buffer,
    ) => {
        if (asset === LBTC) {
            return lcCT(
                utxos as LiquidClaimDetails[],
                destinationScript as Buffer,
                BigInt(fee),
                isRbf,
                liquidNetwork,
                blindingKey,
            );
        }
        return constructClaimTransaction(
            utxos as ClaimDetails[],
            destinationScript,
            BigInt(fee),
            isRbf,
        );
    };
};

export const getConstructRefundTransaction = (
    asset: string,
    addOneSatBuffer: boolean,
) => {
    return (
        refundDetails: RefundDetails[] | LiquidRefundDetails[],
        outputScript: Uint8Array,
        timeoutBlockHeight: number,
        feePerVbyte: number,
        isRbf: boolean,
        liquidNetwork?: LiquidNetwork,
        blindingKey?: Buffer,
    ) => {
        if (asset === LBTC) {
            return targetFee(
                feePerVbyte,
                (fee) =>
                    lcRT(
                        refundDetails as LiquidRefundDetails[],
                        outputScript as Buffer,
                        timeoutBlockHeight,
                        addOneSatBuffer ? fee + BigInt(1) : fee,
                        isRbf,
                        liquidNetwork,
                        blindingKey,
                    ),
                true,
            );
        }

        return targetFee(feePerVbyte, (fee) =>
            constructRefundTransaction(
                refundDetails as RefundDetails[],
                outputScript,
                timeoutBlockHeight,
                addOneSatBuffer ? fee + BigInt(1) : fee,
                isRbf,
            ),
        );
    };
};

export const getOutputAmount = async (
    asset: string,
    output: TransactionOutput | LiquidTransactionOutputWithKey,
): Promise<number> => {
    if (asset !== LBTC) {
        return Number((output as TransactionOutput).amount);
    }

    const liquidOutput = output as LiquidTransactionOutputWithKey;

    if (
        liquidOutput.rangeProof !== undefined &&
        liquidOutput.rangeProof.length > 0
    ) {
        const { confidential: conf } = await utxoSecp.get();
        if (liquidOutput.blindingPrivateKey === undefined) {
            throw new Error("missing blinding private key for output");
        }
        const unblinded = conf.unblindOutputWithKey(
            liquidOutput,
            liquidOutput.blindingPrivateKey,
        );
        return Number(unblinded.value);
    }

    return confidential.confidentialValueToSatoshi(liquidOutput.value);
};

export const txToHex = (transaction: TransactionInterface): string =>
    transaction instanceof LiquidTransaction
        ? transaction.toHex()
        : (transaction as BtcTransaction).hex;

export const txToId = (transaction: TransactionInterface): string =>
    transaction instanceof LiquidTransaction
        ? transaction.getId()
        : (transaction as BtcTransaction).id;

export const setCooperativeWitness = (
    tx: TransactionInterface,
    index: number,
    witness: Uint8Array,
) => {
    if (tx instanceof LiquidTransaction) {
        tx.ins[index].witness = [Buffer.from(witness)];
    } else {
        (tx as BtcTransaction).updateInput(index, {
            finalScriptWitness: [witness],
        });
    }
};
