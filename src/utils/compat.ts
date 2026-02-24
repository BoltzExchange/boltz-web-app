import { hex } from "@scure/base";
import {
    Address,
    Transaction as BtcTransaction,
    OutScript,
} from "@scure/btc-signer";
import type { TransactionOutput } from "@scure/btc-signer/psbt.js";
import { NETWORK, TEST_NETWORK } from "@scure/btc-signer/utils.js";
import type { BTC_NETWORK } from "@scure/btc-signer/utils.js";
import type { ClaimDetails, RefundDetails } from "boltz-core";
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

const btcNetworks: Record<string, BTC_NETWORK> = {
    bitcoin: NETWORK,
    mainnet: NETWORK,
    testnet: TEST_NETWORK,
    regtest: { bech32: "bcrt", pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef },
};

const getBtcNetwork = (network?: string): BTC_NETWORK => {
    network = network ?? config.network;
    const bitcoinNet = network === "mainnet" ? "bitcoin" : network;
    return btcNetworks[bitcoinNet];
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

    // BTC: use @scure/btc-signer Address
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
        } else {
            return targetFee(feePerVbyte, (fee) =>
                constructRefundTransaction(
                    refundDetails as RefundDetails[],
                    outputScript,
                    timeoutBlockHeight,
                    addOneSatBuffer ? fee + BigInt(1) : fee,
                    isRbf,
                ),
            );
        }
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
        return liquidTx.outs.find(
            (o) => o.script && Buffer.from(targetScript).equals(o.script),
        );
    } else {
        const btcTx = tx as BtcTransaction;
        for (let i = 0; i < btcTx.outputsLength; i++) {
            const out = btcTx.getOutput(i);
            if (
                out.script &&
                out.script.length === targetScript.length &&
                out.script.every((b, j) => b === targetScript[j])
            ) {
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
    getTransaction,
    DecodedAddress,
    getOutputAmount,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
    LiquidTransactionOutputWithKey,
    probeUserInput,
};
