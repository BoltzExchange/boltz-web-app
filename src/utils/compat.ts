import type { Network } from "bitcoinjs-lib";
import { Transaction, address, networks } from "bitcoinjs-lib";
import type {
    ClaimDetails,
    RefundDetails,
    TransactionOutput,
} from "boltz-core";
import {
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
import type { Buffer } from "buffer";
import type { TxOutput as LiquidTransactionOutput } from "liquidjs-lib";
import {
    address as LiquidAddress,
    networks as LiquidNetworks,
    Transaction as LiquidTransaction,
    confidential,
} from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { config } from "../config";
import { BTC, LBTC, LN } from "../consts/Assets";
import secp from "../lazy/secp";
import {
    extractAddress,
    extractInvoice,
    isBolt12Offer,
    isInvoice,
    isLnurl,
} from "./invoice";

type LiquidTransactionOutputWithKey = LiquidTransactionOutput & {
    blindingPrivateKey?: Buffer;
};

type DecodedAddress = { script: Buffer; blindingKey?: Buffer };

const possibleUserInputTypes = [LN, LBTC, BTC];

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

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            /* empty */
        }
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

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

const probeUserInputOption = async (
    asset: string,
    input: string,
): Promise<boolean> => {
    switch (asset) {
        case LN: {
            const invoice = extractInvoice(input);
            return (
                isLnurl(invoice) ||
                isInvoice(invoice) ||
                (await isBolt12Offer(invoice))
            );
        }

        default:
            try {
                const address = extractAddress(input);
                decodeAddress(asset, address);
                return true;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                return false;
            }
    }
};

const probeUserInput = async (
    expectedAsset: string,
    input: string,
): Promise<string | null> => {
    if (typeof input !== "string") {
        return null;
    }

    if (
        expectedAsset !== "" &&
        (await probeUserInputOption(expectedAsset, input))
    ) {
        return expectedAsset;
    }

    for (const asset of possibleUserInputTypes) {
        if (await probeUserInputOption(asset, input)) {
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
        return LiquidNetworks[liquidNet] as LiquidNetwork;
    } else {
        const bitcoinNet = network === "mainnet" ? "bitcoin" : network;
        return networks[bitcoinNet] as Network;
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
        targetFee(
            feePerVbyte,
            (fee) =>
                fn(
                    refundDetails as never[],
                    outputScript,
                    timeoutBlockHeight,
                    addOneSatBuffer ? fee + 1 : fee,
                    isRbf,
                    liquidNetwork,
                    blindingKey,
                ),
            true,
        );
};

const getOutputAmount = async (
    asset: string,
    output: TransactionOutput | LiquidTransactionOutputWithKey,
): Promise<number> => {
    if (asset !== LBTC) {
        return (output as TransactionOutput).value;
    }

    output = output as LiquidTransactionOutputWithKey;

    if (output.rangeProof?.length !== 0) {
        const { confidential } = await secp.get();
        const unblinded = confidential.unblindOutputWithKey(
            output,
            output.blindingPrivateKey,
        );
        return Number(unblinded.value);
    } else {
        return confidential.confidentialValueToSatoshi(output.value);
    }
};

export {
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
