import { hex } from "@scure/base";
import {
    Address,
    Transaction as BtcTransaction,
    OutScript,
} from "@scure/btc-signer";
import { type BTC_NETWORK, equalBytes } from "@scure/btc-signer/utils.js";
import type { ClaimDetails, RefundDetails } from "boltz-core";
import {
    Networks,
    constructClaimTransaction,
    constructRefundTransaction,
    targetFee,
} from "boltz-core";
import type {
    LiquidClaimDetails,
    LiquidRefundDetails,
} from "boltz-core/dist/lib/liquid";
import {
    constructClaimTransaction as lcCT,
    constructRefundTransaction as lcRT,
} from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import type { TxOutput as LiquidTransactionOutput } from "liquidjs-lib";
import {
    address as LiquidAddress,
    networks as LiquidNetworks,
    Transaction as LiquidTransaction,
} from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "./assets";
import { type NetworkType, getConfig } from "./config";
import { resolveValue } from "./internal";

export type LiquidTransactionOutputWithKey = LiquidTransactionOutput & {
    blindingPrivateKey?: Buffer;
};

export type DecodedAddress = { script: Uint8Array; blindingKey?: Buffer };

export type TransactionInterface = BtcTransaction | LiquidTransaction;

/**
 * Resolve the effective network: explicit parameter > SDK config.
 * Throws if neither is available.
 */
const resolveNetwork = (network?: NetworkType): NetworkType => {
    if (network) return network;
    const cfgNetwork = getConfig().network;
    if (!cfgNetwork) {
        throw new Error(
            "No network configured. Pass network explicitly or set it in init().",
        );
    }
    return resolveValue(cfgNetwork);
};

export const getBtcNetwork = (network?: NetworkType): BTC_NETWORK => {
    const net = resolveNetwork(network);
    switch (net) {
        case "mainnet":
            return Networks.bitcoin;
        case "testnet":
            return Networks.testnet;
        case "regtest":
            return Networks.regtest;
        default:
            throw new Error(`unknown network: ${net as string}`);
    }
};

export const getNetwork = (
    asset: string,
    network?: NetworkType,
): BTC_NETWORK | LiquidNetwork => {
    const net = resolveNetwork(network);
    if (asset === LBTC) {
        const liquidNet = net === "mainnet" ? "liquid" : net;
        return LiquidNetworks[liquidNet] as LiquidNetwork;
    } else {
        return getBtcNetwork(net);
    }
};

export const decodeAddress = (
    asset: string,
    addr: string,
    network?: NetworkType,
): DecodedAddress => {
    const net = resolveNetwork(network);

    if (asset === LBTC) {
        const liquidNet = net === "mainnet" ? "liquid" : net;
        const liquidNetwork = LiquidNetworks[liquidNet] as LiquidNetwork;
        const script = LiquidAddress.toOutputScript(addr, liquidNetwork);

        // This throws for unconfidential addresses -> fallback to output script decoding
        try {
            const decoded = LiquidAddress.fromConfidential(addr);

            return {
                script,
                blindingKey: decoded.blindingKey,
            };

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            /* empty */
        }

        return { script };
    }

    const btcAddr = Address(getBtcNetwork(net));
    const decoded = btcAddr.decode(addr);
    const script = OutScript.encode(decoded);

    return { script };
};

export const validateAddress = (
    asset: string,
    addr: string,
    network?: NetworkType,
): boolean => {
    try {
        decodeAddress(asset, addr, network);
        return true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

export const isConfidentialAddress = (addr: string): boolean => {
    try {
        LiquidAddress.fromConfidential(addr);
        return true;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

export const getTransaction = (asset: string) => {
    if (asset === LBTC) {
        return {
            fromHex: (hexStr: string) => LiquidTransaction.fromHex(hexStr),
        };
    } else {
        return {
            fromHex: (hexStr: string) =>
                BtcTransaction.fromRaw(hex.decode(hexStr), {
                    allowUnknownOutputs: true,
                    allowUnknownInputs: true,
                }),
        };
    }
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
        } else {
            return constructClaimTransaction(
                utxos as ClaimDetails[],
                destinationScript,
                BigInt(fee),
                isRbf,
            );
        }
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

export const findOutputByScript = (
    asset: string,
    tx: BtcTransaction | LiquidTransaction,
    targetScript: Uint8Array,
) => {
    if (asset === LBTC) {
        const liquidTx = tx as LiquidTransaction;
        const target = Buffer.from(targetScript);
        return liquidTx.outs.find((o) => o.script && target.equals(o.script));
    } else {
        const btcTx = tx as BtcTransaction;
        for (let i = 0; i < btcTx.outputsLength; i++) {
            const out = btcTx.getOutput(i);
            if (out.script && equalBytes(out.script, targetScript)) {
                return out;
            }
        }
        return undefined;
    }
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
