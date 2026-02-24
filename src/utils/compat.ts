import { hex } from "@scure/base";
import {
    Address,
    Transaction as BtcTransaction,
    OutScript,
} from "@scure/btc-signer";
import type { TransactionOutput } from "@scure/btc-signer/psbt.js";
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

type DecodedAddress = { script: Uint8Array; blindingKey?: Buffer };

const possibleUserInputTypes = [LN, LBTC, BTC];

const getBtcNetwork = (network?: string): BTC_NETWORK => {
    switch (network ?? config.network) {
        case "mainnet":
            return Networks.bitcoin;
        case "testnet":
            return Networks.testnet;
        case "regtest":
            return Networks.regtest;
        default:
            throw new Error(`unknown network: ${network}`);
    }
};

const decodeAddress = (asset: string, addr: string): DecodedAddress => {
    if (asset === LBTC) {
        const liquidNet =
            config.network === "mainnet" ? "liquid" : config.network;
        const network = LiquidNetworks[liquidNet] as LiquidNetwork;
        const script = LiquidAddress.toOutputScript(addr, network);

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

    const btcAddr = Address(getBtcNetwork());
    const decoded = btcAddr.decode(addr);
    const script = OutScript.encode(decoded);

    return { script };
};

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
): BTC_NETWORK | LiquidNetwork => {
    network = network ?? config.network;
    if (asset === LBTC) {
        const liquidNet = network === "mainnet" ? "liquid" : network;
        return LiquidNetworks[liquidNet] as LiquidNetwork;
    } else {
        return getBtcNetwork(network);
    }
};

const getTransaction = (asset: string) => {
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

const getConstructClaimTransaction = (asset: string) => {
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

const getConstructRefundTransaction = (
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

const getOutputAmount = async (
    asset: string,
    output: TransactionOutput | LiquidTransactionOutputWithKey,
): Promise<number> => {
    if (asset !== LBTC) {
        return Number((output as TransactionOutput).amount);
    }

    const liquidOutput = output as LiquidTransactionOutputWithKey;

    if (liquidOutput.rangeProof?.length > 0) {
        const { confidential } = await secp.get();
        const unblinded = confidential.unblindOutputWithKey(
            liquidOutput,
            liquidOutput.blindingPrivateKey,
        );
        return Number(unblinded.value);
    } else {
        return confidential.confidentialValueToSatoshi(liquidOutput.value);
    }
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
            if (
                out.script &&
                out.script.length === targetScript.length &&
                equalBytes(out.script, targetScript)
            ) {
                return out;
            }
        }
        return undefined;
    }
};

type TransactionInterface = BtcTransaction | LiquidTransaction;

const txToHex = (transaction: TransactionInterface): string =>
    transaction instanceof LiquidTransaction
        ? transaction.toHex()
        : (transaction as BtcTransaction).hex;

const txToId = (transaction: TransactionInterface): string =>
    transaction instanceof LiquidTransaction
        ? transaction.getId()
        : (transaction as BtcTransaction).id;

const setCooperativeWitness = (
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

export {
    findOutputByScript,
    validateAddress,
    getNetwork,
    decodeAddress,
    getTransaction,
    DecodedAddress,
    getOutputAmount,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
    LiquidTransactionOutputWithKey,
    TransactionInterface,
    txToHex,
    txToId,
    setCooperativeWitness,
    probeUserInput,
};
