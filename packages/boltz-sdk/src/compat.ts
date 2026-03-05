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

/** A Liquid transaction output extended with an optional blinding private key. */
export type LiquidTransactionOutputWithKey = LiquidTransactionOutput & {
    blindingPrivateKey?: Buffer;
};

/** Decoded on-chain address: output script and optional Liquid blinding key. */
export type DecodedAddress = { script: Uint8Array; blindingKey?: Buffer };

/** Union of Bitcoin and Liquid transaction types. */
export type TransactionInterface = BtcTransaction | LiquidTransaction;

/**
 * Resolve the effective network: explicit parameter > SDK config.
 * Throws if neither is available.
 *
 * @param network - Optional explicit network override.
 * @returns The resolved network type.
 * @throws When no network is configured and none is passed explicitly.
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

/**
 * Get the `@scure/btc-signer` network object for Bitcoin.
 *
 * @param network - Optional network override.
 * @returns The matching BTC_NETWORK.
 */
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

/**
 * Get the network parameters object for a given asset.
 *
 * Returns a `BTC_NETWORK` for BTC or a `LiquidNetwork` for L-BTC.
 *
 * @param asset - Asset identifier (e.g. `"BTC"` or `"L-BTC"`).
 * @param network - Optional network override.
 * @returns The network parameters object.
 */
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

/**
 * Decode an on-chain address into its output script and optional blinding key.
 *
 * Supports both Bitcoin and Liquid (including confidential) addresses.
 *
 * @param asset - Asset identifier.
 * @param addr - The address string to decode.
 * @param network - Optional network override.
 * @returns The decoded address components.
 */
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

/**
 * Check whether an address is valid for the given asset and network.
 *
 * @param asset - Asset identifier.
 * @param addr - Address string to validate.
 * @param network - Optional network override.
 * @returns `true` if the address can be decoded without error.
 */
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

/**
 * Check whether a Liquid address is confidential (has a blinding key).
 *
 * @param addr - Liquid address string.
 * @returns `true` if the address is confidential.
 */
export const isConfidentialAddress = (addr: string): boolean => {
    try {
        LiquidAddress.fromConfidential(addr);
        return true;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

/**
 * Get a transaction deserialiser for the given asset.
 *
 * Returns an object with a `fromHex` method that parses a raw hex string
 * into a Bitcoin or Liquid transaction.
 *
 * @param asset - Asset identifier.
 * @returns An object with `fromHex(hexStr)`.
 */
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

/**
 * Get a claim transaction constructor for the given asset.
 *
 * Returns a function that builds a claim transaction from UTXOs,
 * a destination script, and a fee.
 *
 * @param asset - Asset identifier.
 * @returns A claim transaction builder function.
 */
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

/**
 * Get a refund transaction constructor for the given asset.
 *
 * Uses `targetFee` to iteratively find the correct fee for the transaction.
 *
 * @param asset - Asset identifier.
 * @param addOneSatBuffer - When `true`, adds 1 satoshi to the fee to avoid
 *   dust-related issues on some networks.
 * @returns A refund transaction builder function.
 */
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

/**
 * Find a transaction output matching a given script.
 *
 * Works for both Bitcoin and Liquid transactions.
 *
 * @param asset - Asset identifier.
 * @param tx - The transaction to search.
 * @param targetScript - The output script to match against.
 * @returns The matching output, or `undefined` if not found.
 */
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

/**
 * Serialise a transaction to its hex-encoded string.
 *
 * @param transaction - A Bitcoin or Liquid transaction.
 * @returns The hex-encoded raw transaction.
 */
export const txToHex = (transaction: TransactionInterface): string =>
    transaction instanceof LiquidTransaction
        ? transaction.toHex()
        : (transaction as BtcTransaction).hex;

/**
 * Extract the transaction ID from a Bitcoin or Liquid transaction.
 *
 * @param transaction - A Bitcoin or Liquid transaction.
 * @returns The transaction ID string.
 */
export const txToId = (transaction: TransactionInterface): string =>
    transaction instanceof LiquidTransaction
        ? transaction.getId()
        : (transaction as BtcTransaction).id;

/**
 * Set the cooperative (key-path) witness on a transaction input.
 *
 * Used after MuSig2 signing to apply the aggregated Schnorr signature.
 *
 * @param tx - The transaction to update.
 * @param index - The input index.
 * @param witness - The serialised witness data (aggregated signature).
 */
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
