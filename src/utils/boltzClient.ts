import { Transaction } from "bitcoinjs-lib";
import { Musig } from "boltz-core";
import { Buffer } from "buffer";
import { Transaction as LiquidTransaction } from "liquidjs-lib";

import { fetcher } from "./apiClient";

type PartialSignature = {
    pubNonce: Buffer;
    signature: Buffer;
};

type TransactionInterface = Transaction | LiquidTransaction;

export const getPartialRefundSignature = (
    id: string,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    return new Promise<PartialSignature>((resolve, reject) => {
        fetcher(
            "/v2/swap/submarine/refund",
            (data) => {
                resolve({
                    pubNonce: Musig.parsePubNonce(data.pubNonce),
                    signature: Buffer.from(data.partialSignature, "hex"),
                });
            },
            {
                id,
                index,
                pubNonce: pubNonce.toString("hex"),
                transaction: transaction.toHex(),
            },
            reject,
        );
    });
};

export const getPartialReverseClaimSignature = (
    id: string,
    preimage: Buffer,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    return new Promise<PartialSignature>((resolve, reject) => {
        fetcher(
            "/v2/swap/reverse/claim",
            (data) => {
                resolve({
                    pubNonce: Musig.parsePubNonce(data.pubNonce),
                    signature: Buffer.from(data.partialSignature, "hex"),
                });
            },
            {
                id,
                index,
                preimage: preimage.toString("hex"),
                pubNonce: pubNonce.toString("hex"),
                transaction: transaction.toHex(),
            },
            reject,
        );
    });
};

export { TransactionInterface, PartialSignature };
