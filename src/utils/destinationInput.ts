import type { Pairs } from "boltz-swaps/client";
import { isKnownTokenAddress } from "boltz-swaps/evm";
import { isValidSolanaAddress } from "boltz-swaps/solana";
import { isValidTronAddress } from "boltz-swaps/tron";
import { NetworkTransport } from "boltz-swaps/types";
import { getAddress, isAddress } from "viem";

import {
    LN,
    getNetworkTransport,
    isBitcoinOnlyAsset,
    isEvmAsset,
} from "../consts/Assets";
import Pair from "./Pair";
import { probeUserInput } from "./compat";
import { btcToSat } from "./denomination";
import {
    decodeInvoice,
    extractAddress,
    extractBip21Amount,
    extractInvoice,
    isInvoice,
} from "./invoice";

type DestinationAmount = {
    receiveAmount: ReturnType<typeof btcToSat>;
    sendAmount: Awaited<ReturnType<Pair["calculateSendAmount"]>>;
};

export enum DestinationInputStatus {
    Empty = "empty",
    Stale = "stale",
    Invalid = "invalid",
    Valid = "valid",
}

export enum DestinationInputType {
    Address = "address",
    Invoice = "invoice",
}

export enum DestinationInputError {
    TokenAddress = "token_address",
    UnknownAsset = "unknown_asset",
    BitcoinOnly = "bitcoin_only",
    InvalidInvoice = "invalid_invoice",
    AmountCalculation = "amount_calculation",
    InvalidInput = "invalid_input",
}

type DestinationAddress = {
    type: DestinationInputType.Address;
    address: string;
};

type DestinationInvoice = {
    type: DestinationInputType.Invoice;
    invoice: string;
};

export type DestinationInputResult =
    | { status: DestinationInputStatus.Empty | DestinationInputStatus.Stale }
    | {
          status: DestinationInputStatus.Invalid;
          error: DestinationInputError;
          cause?: unknown;
      }
    | {
          status: DestinationInputStatus.Valid;
          nextPair: Pair;
          switched: boolean;
          destination: DestinationAddress | DestinationInvoice;
          amount?: DestinationAmount;
      };

const createSwitchedPair = (
    currentPair: Pair,
    actualAsset: string,
    pairs: Pairs | undefined,
    regularPairs: Pairs | undefined,
) => {
    if (actualAsset === LN) {
        return new Pair(
            pairs,
            currentPair.fromAsset === LN
                ? currentPair.toAsset
                : currentPair.fromAsset,
            LN,
            regularPairs,
        );
    }

    const fromAsset =
        currentPair.toAsset === LN
            ? currentPair.fromAsset === actualAsset
                ? LN
                : currentPair.fromAsset
            : currentPair.toAsset;

    return new Pair(pairs, fromAsset, actualAsset, regularPairs);
};

const invalidResult = (
    error: DestinationInputError,
    cause?: unknown,
): DestinationInputResult => ({
    status: DestinationInputStatus.Invalid,
    error,
    cause,
});

export const parseDestinationInput = async (
    inputValue: string,
    currentPair: Pair,
    pairs: Pairs | undefined,
    regularPairs: Pairs | undefined,
    minerFee: number,
    bitcoinOnly: boolean,
    isStale: () => boolean = () => false,
): Promise<DestinationInputResult> => {
    if (inputValue.length === 0) {
        return { status: DestinationInputStatus.Empty };
    }

    let address: string;
    let invoice: string;
    try {
        address = extractAddress(inputValue);
        invoice = extractInvoice(inputValue) ?? "";
    } catch (error) {
        return invalidResult(DestinationInputError.InvalidInput, error);
    }

    const assetName = currentPair.toAsset;

    try {
        if (isKnownTokenAddress(assetName, address)) {
            return invalidResult(DestinationInputError.TokenAddress);
        }

        if (isEvmAsset(assetName) && isAddress(address)) {
            return {
                status: DestinationInputStatus.Valid,
                nextPair: currentPair,
                switched: false,
                destination: {
                    type: DestinationInputType.Address,
                    address: getAddress(address),
                },
            };
        }

        const transport = getNetworkTransport(assetName);
        if (
            transport === NetworkTransport.Solana &&
            isValidSolanaAddress(address)
        ) {
            return {
                status: DestinationInputStatus.Valid,
                nextPair: currentPair,
                switched: false,
                destination: { type: DestinationInputType.Address, address },
            };
        }

        if (
            transport === NetworkTransport.Tron &&
            isValidTronAddress(address)
        ) {
            return {
                status: DestinationInputStatus.Valid,
                nextPair: currentPair,
                switched: false,
                destination: { type: DestinationInputType.Address, address },
            };
        }

        const actualAsset =
            probeUserInput(assetName, invoice) ??
            probeUserInput(assetName, address);

        if (isStale()) {
            return { status: DestinationInputStatus.Stale };
        }

        if (actualAsset === null) {
            return invalidResult(DestinationInputError.UnknownAsset);
        }

        if (
            actualAsset !== LN &&
            bitcoinOnly &&
            !isBitcoinOnlyAsset(actualAsset)
        ) {
            return invalidResult(DestinationInputError.BitcoinOnly);
        }

        const switched = assetName !== actualAsset;
        const nextPair = switched
            ? createSwitchedPair(currentPair, actualAsset, pairs, regularPairs)
            : currentPair;

        let amount: DestinationAmount | undefined;
        const bip21Amount = extractBip21Amount(inputValue);
        let hasFixedInvoiceAmount = false;
        if (actualAsset === LN && isInvoice(invoice)) {
            try {
                hasFixedInvoiceAmount = decodeInvoice(invoice).satoshis > 0;
            } catch (error) {
                return invalidResult(
                    DestinationInputError.InvalidInvoice,
                    error,
                );
            }
        }

        const shouldApplyBip21Amount =
            bip21Amount !== null && !hasFixedInvoiceAmount;

        if (shouldApplyBip21Amount) {
            const receiveAmount = btcToSat(bip21Amount);
            let sendAmount: DestinationAmount["sendAmount"];
            try {
                sendAmount = await nextPair.calculateSendAmount(
                    receiveAmount,
                    minerFee,
                );
            } catch (error) {
                if (isStale()) {
                    return { status: DestinationInputStatus.Stale };
                }

                return invalidResult(
                    DestinationInputError.AmountCalculation,
                    error,
                );
            }

            if (isStale()) {
                return { status: DestinationInputStatus.Stale };
            }

            amount = { receiveAmount, sendAmount };
        }

        return {
            status: DestinationInputStatus.Valid,
            nextPair,
            switched,
            destination:
                actualAsset === LN
                    ? { type: DestinationInputType.Invoice, invoice }
                    : { type: DestinationInputType.Address, address },
            amount,
        };
    } catch (error) {
        if (isStale()) {
            return { status: DestinationInputStatus.Stale };
        }

        return invalidResult(DestinationInputError.InvalidInput, error);
    }
};
