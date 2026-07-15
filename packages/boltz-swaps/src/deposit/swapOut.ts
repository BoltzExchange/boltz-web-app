import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";

import { executeChainSwap } from "../chain.ts";
import {
    type ChainSwapCreatedResponse,
    type SubmarineCreatedResponse,
    type SubmarinePairTypeTaproot,
    createChainSwap,
    createSubmarineSwap,
    getPairs,
} from "../client.ts";
import { SwapType } from "../types.ts";
import type { ECKeys } from "../utxo/index.ts";
import { DepositRefundableError } from "./errors.ts";
import {
    buildChainQuote,
    buildSubmarineQuote,
    chainReceiveSats,
} from "./quote.ts";
import type {
    DepositQuote,
    DepositQuoteTarget,
    DepositRecord,
} from "./types.ts";

const randomKeypair = (): ECKeys => {
    const privateKey = secp256k1.utils.randomSecretKey();
    return { privateKey, publicKey: secp256k1.getPublicKey(privateKey, true) };
};

// Inverts the submarine fee model (expectedAmount ≈ invoiceSats · rate ·
// (1 + pct) + minerFees), undershooting slightly so the resulting swap locks no
// more than the already-committed budget.
const estimateSubmarineReceiveSats = (
    lockBudgetSats: number,
    pair: SubmarinePairTypeTaproot,
): number => {
    const rate = pair.rate > 0 ? pair.rate : 1;
    const pct = pair.fees.percentage / 100;
    const net = lockBudgetSats - pair.fees.minerFees;
    if (net <= 0) {
        return 0;
    }
    return Math.max(0, Math.floor((net / (rate * (1 + pct))) * 0.995));
};

export type OutSwapResult = {
    kind: "chain" | "submarine";
    swapId: string;
    createdSwap: ChainSwapCreatedResponse | SubmarineCreatedResponse;
    preimage?: string; // hex, chain only
    preimageHash: string; // hex
    claimPrivateKey?: string; // hex, chain only
    blindingKey?: string;
    receiveAmountSats: number;
    lockAmountSats: number;
    quote: DepositQuote;
};

// Create the out-swap sized to `mintedSats` (the actual bridged amount, 8dp).
// For chain out the SDK owns the preimage + UTXO claim keypair; for LN the
// preimage is the invoice's.
export const createOutSwap = async (args: {
    depositId: string;
    target: DepositQuoteTarget;
    mintedSats: number;
    bridgeFee: bigint;
    asset: string;
    signal?: AbortSignal;
}): Promise<OutSwapResult> => {
    const { depositId, target, mintedSats, bridgeFee, asset, signal } = args;
    const pairs = await getPairs();

    if (target.type === "chain") {
        const pair = pairs[SwapType.Chain]?.[asset]?.[target.to];
        if (pair === undefined) {
            throw new DepositRefundableError(
                `Boltz offers no ${asset} -> ${target.to} chain swap`,
            );
        }
        if (
            mintedSats < pair.limits.minimal ||
            mintedSats > pair.limits.maximal
        ) {
            throw new DepositRefundableError(
                `bridged amount ${mintedSats} sats is outside the ${asset} -> ${target.to} limits [${pair.limits.minimal}, ${pair.limits.maximal}]`,
            );
        }

        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const preimageHash = sha256(preimage);
        const claimKeys = randomKeypair();

        const created = await createChainSwap(
            asset,
            target.to,
            mintedSats,
            hex.encode(preimageHash),
            hex.encode(claimKeys.publicKey),
            undefined, // EVM lockup side refunds via the commitment, no UTXO key
            target.address,
            pair.hash,
        );

        return {
            kind: "chain",
            swapId: created.id,
            createdSwap: created,
            preimage: hex.encode(preimage),
            preimageHash: hex.encode(preimageHash),
            claimPrivateKey: hex.encode(claimKeys.privateKey),
            blindingKey: created.claimDetails.blindingKey,
            receiveAmountSats: chainReceiveSats(created, pair),
            lockAmountSats: created.lockupDetails.amount,
            quote: buildChainQuote({
                depositId,
                swapId: created.id,
                created,
                to: target.to,
                pair,
                bridgeFee,
            }),
        };
    }

    const pair = pairs[SwapType.Submarine]?.[asset]?.["BTC"];
    if (pair === undefined) {
        throw new DepositRefundableError(
            `Boltz offers no ${asset} -> BTC submarine swap`,
        );
    }
    if (mintedSats < pair.limits.minimal || mintedSats > pair.limits.maximal) {
        throw new DepositRefundableError(
            `bridged amount ${mintedSats} sats is outside the ${asset} -> BTC limits [${pair.limits.minimal}, ${pair.limits.maximal}]`,
        );
    }

    // The server claims the whole locked commitment on settlement, so the
    // invoice must be sized to that amount: fetch a fresh one and reject a
    // pre-made fixed-amount invoice, whose surplus would be forfeited.
    //
    // Dynamic import: `resolveInvoice`/`invoice` eagerly pull bolt11/bolt12
    // (optional peers), so a static import would break `check:lazy`.
    const { resolveInvoice } = await import("../resolveInvoice.ts");
    const { decodeInvoice, isInvoice } = await import("../invoice.ts");

    if (isInvoice(target.destination)) {
        throw new Error(
            "a fixed-amount Lightning invoice cannot be used for a deposit swap-out; " +
                "supply a fetchable destination (LNURL, Lightning address, BOLT12 offer, " +
                "or BIP-353 name) so the invoice can be sized to the locked amount",
        );
    }

    const requestSats = estimateSubmarineReceiveSats(mintedSats, pair);
    if (requestSats <= 0) {
        throw new DepositRefundableError(
            `bridged amount ${mintedSats} sats is too small to swap out over Lightning after fees`,
        );
    }

    const { invoice } = await resolveInvoice(target.destination, requestSats, {
        signal,
    });
    const decoded = decodeInvoice(invoice);

    const created = await createSubmarineSwap(asset, "BTC", invoice, pair.hash);
    if (created.expectedAmount > mintedSats) {
        throw new DepositRefundableError(
            `resolved invoice requires locking ${created.expectedAmount} sats but only ${mintedSats} were bridged`,
        );
    }

    return {
        kind: "submarine",
        swapId: created.id,
        createdSwap: created,
        preimageHash: decoded.preimageHash,
        receiveAmountSats: decoded.satoshis,
        // The server claims the full bridged amount, not `expectedAmount`;
        // report the true cost including the forfeited surplus.
        lockAmountSats: mintedSats,
        quote: buildSubmarineQuote({
            depositId,
            swapId: created.id,
            lockAmountSats: mintedSats,
            invoiceSats: decoded.satoshis,
            bridgeFee,
        }),
    };
};

// Claim the UTXO out-swap once the server has locked, using the SDK-generated
// claim keypair. Submarine out has no claim step (the server pays the invoice).
export const claimChainOut = async (record: DepositRecord): Promise<string> => {
    if (record.swapKind !== "chain" || record.createdSwap === undefined) {
        throw new Error("deposit is not a chain out-swap");
    }
    if (record.target?.type !== "chain") {
        throw new Error("deposit is missing a chain target");
    }
    if (
        record.preimage === undefined ||
        record.claimPrivateKey === undefined ||
        record.receiveAmountSats === undefined
    ) {
        throw new Error("deposit is missing chain claim material");
    }

    const privateKey = hex.decode(record.claimPrivateKey);
    const claimKeys: ECKeys = {
        privateKey,
        publicKey: secp256k1.getPublicKey(privateKey, true),
    };

    const result = await executeChainSwap({
        createdSwap: record.createdSwap as ChainSwapCreatedResponse,
        to: record.target.to,
        preimage: record.preimage,
        claimAddress: record.target.address,
        utxoClaim: {
            claimKeys,
            receiveAmount: record.receiveAmountSats,
            blindingKey: record.blindingKey,
        },
    });
    return result.claimTransactionId;
};
