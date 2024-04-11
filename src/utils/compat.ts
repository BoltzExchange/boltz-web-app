import zkp, { Secp256k1ZKP } from "@vulpemventures/secp256k1-zkp";
import { Network, Transaction, address, networks } from "bitcoinjs-lib";
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
    address as LiquidAddress,
    networks as LiquidNetworks,
    Transaction as LiquidTransaction,
    TxOutput as LiquidTransactionOutput,
    confidential,
} from "liquidjs-lib";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { config } from "../config";
import { BTC, LBTC, LN } from "../consts/Assets";
import { isInvoice, isLnurl } from "./invoice";

type LiquidTransactionOutputWithKey = LiquidTransactionOutput & {
    blindingPrivateKey?: Buffer;
};

type DecodedAddress = { script: Buffer; blindingKey?: Buffer };

export let secp: Secp256k1ZKP;
let confi: confidential.Confidential;

const possibleUserInputTypes = [LN, LBTC, BTC];

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

const decodeAddress = (asset: string, addr: string): DecodedAddress => {
    const address = getAddress(asset);

    // We always do this to validate the network
    const script = address.toOutputScript(
        addr,
        getNetwork(asset) as LiquidNetwork,
    );

    if (asset === LBTC) {
        // This throws for unconfidential addresses -> fallback to output script decoding
        try {
            const decoded = (address as typeof LiquidAddress).fromConfidential(
                addr,
            );

            return {
                script,
                blindingKey: decoded.blindingKey,
            };
        } catch (e) {}
    }

    return {
        script,
    };
};

export const isConfidentialAddress = (addr: string): boolean => {
    try {
        const address = getAddress(LBTC);
        (address as typeof LiquidAddress).fromConfidential(addr);
        return true;
    } catch (e) {
        return false;
    }
};

const probeUserInputOption = (asset: string, input: string): boolean => {
    switch (asset) {
        case LN:
            return isLnurl(input) || isInvoice(input);

        default:
            try {
                decodeAddress(asset, input);
                return true;
            } catch (e) {
                return false;
            }
    }
};

const probeUserInput = (
    expectedAsset: string,
    input: string,
): string | null => {
    if (expectedAsset !== "" && probeUserInputOption(expectedAsset, input)) {
        return expectedAsset;
    }

    for (const asset of possibleUserInputTypes.filter(
        (type) => type !== expectedAsset,
    )) {
        if (probeUserInputOption(asset, input)) {
            return asset;
        }
    }

    return null;
};

const getNetwork = (
    asset: string,
    network?: string,
): Network | LiquidNetwork => {
    network = network ?? config.network;
    if (asset === LBTC) {
        const liquidNet = network === "mainnet" ? "liquid" : network;
        return LiquidNetworks[liquidNet];
    } else {
        const bitcoinNet = network === "mainnet" ? "bitcoin" : network;
        return networks[bitcoinNet];
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

const getConstructRefundTransaction = (
    asset: string,
    addOneSatBuffer: boolean,
) => {
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
                addOneSatBuffer ? fee + 1 : fee,
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
    getAddress,
    getNetwork,
    decodeAddress,
    getTransaction,
    DecodedAddress,
    getOutputAmount,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
    LiquidTransactionOutputWithKey,
    probeUserInput,
};
