import type { Transaction as BtcTransaction } from "@scure/btc-signer";
import { equalBytes } from "@scure/btc-signer/utils.js";
import { isBolt12Offer } from "boltz-swaps/invoice";
import { isValidSolanaAddress } from "boltz-swaps/solana";
import { isValidTronAddress } from "boltz-swaps/tron";
import { NetworkTransport } from "boltz-swaps/types";
import {
    type UtxoNetwork,
    decodeAddress as utxoDecodeAddress,
    getNetwork as utxoGetNetwork,
} from "boltz-swaps/utxo";
import { Buffer } from "buffer";
import {
    address as LiquidAddress,
    type Transaction as LiquidTransaction,
} from "liquidjs-lib";
import { isAddress } from "viem";

import { config } from "../config";
import { BTC, LBTC, LN, getNetworkTransport } from "../consts/Assets";
import { extractAddress, extractInvoice, isInvoice, isLnurl } from "./invoice";

const possibleUserInputTypes = [LN, LBTC, BTC];

const decodeAddress = (asset: string, addr: string) =>
    utxoDecodeAddress(asset, addr, config.network as UtxoNetwork);

const getNetwork = (asset: string, network?: string) =>
    utxoGetNetwork(asset, (network ?? config.network) as UtxoNetwork);

const validateAddress = (asset: string, addr: string): boolean => {
    try {
        decodeAddress(asset, addr);
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

const probeUserInputOption = (asset: string, input: string): boolean => {
    if (asset === LN) {
        const invoice = extractInvoice(input) ?? "";
        return isLnurl(invoice) || isInvoice(invoice) || isBolt12Offer(invoice);
    }

    try {
        const address = extractAddress(input);
        switch (getNetworkTransport(asset)) {
            case NetworkTransport.Evm:
                return isAddress(address);
            case NetworkTransport.Solana:
                return isValidSolanaAddress(address);
            case NetworkTransport.Tron:
                return isValidTronAddress(address);
            default:
                decodeAddress(asset, address);
                return true;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

const probeUserInput = (
    expectedAsset: string,
    input: string,
): string | null => {
    if (typeof input !== "string") {
        return null;
    }

    if (expectedAsset !== "" && probeUserInputOption(expectedAsset, input)) {
        return expectedAsset;
    }

    for (const asset of possibleUserInputTypes) {
        if (probeUserInputOption(asset, input)) {
            return asset;
        }
    }

    return null;
};

const findOutputByScript = (
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

export {
    findOutputByScript,
    validateAddress,
    getNetwork,
    decodeAddress,
    probeUserInput,
};
