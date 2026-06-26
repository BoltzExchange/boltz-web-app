import { hex } from "@scure/base";
import type { Hex } from "viem";

import {
    type SubmarineCreatedResponse,
    getEipRefundSignature,
    getSubmarineClaimDetails,
    postSubmarineClaimDetails,
} from "./client.ts";
import { getLogger } from "./logger.ts";
import { SwapType } from "./types.ts";
import type {
    ECKeys,
    RefundResult,
    RefundSubmarineUtxoParams,
    UtxoAsset,
} from "./utxo/index.ts";

export type { RefundResult, RefundSubmarineUtxoParams };

export type SignSubmarineClaimArgs = {
    id: string;
    asset: UtxoAsset;
    swapTree: SubmarineCreatedResponse["swapTree"];
    claimPublicKey: string;
    refundKeys: ECKeys;
    invoice: string;
};

export const signSubmarineClaim = async (
    args: SignSubmarineClaimArgs,
): Promise<void> => {
    getLogger().info(
        `Creating cooperative submarine claim signature for ${args.id}`,
    );

    const { decodeInvoice, assertPreimageHash } = await import("./invoice.ts");
    const { preimageHash } = decodeInvoice(args.invoice);

    const claimDetails = await getSubmarineClaimDetails(args.id);
    assertPreimageHash(preimageHash, claimDetails.preimage);

    const { SwapTreeSerializer } = await import("boltz-core");
    const { createMusig, tweakMusig } = await import("./utxo/musig.ts");

    const boltzPublicKey = hex.decode(args.claimPublicKey);
    const keyAgg = createMusig(args.refundKeys, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(args.swapTree as never);
    const tweaked = tweakMusig(args.asset, keyAgg, tree.tree);

    const withNonce = tweaked
        .message(claimDetails.transactionHash)
        .generateNonce();

    const aggNonces = withNonce.aggregateNonces([
        [boltzPublicKey, claimDetails.pubNonce],
    ]);
    const session = aggNonces.initializeSession();
    const signed = session.signPartial();

    await postSubmarineClaimDetails(
        args.id,
        withNonce.publicNonce,
        signed.ourPartialSignature,
    );
};

export const refundSubmarineUtxo = async (
    params: RefundSubmarineUtxoParams,
): Promise<RefundResult> => {
    const { refundSubmarineUtxo: impl } = await import("./utxo/refund.ts");
    return impl(params);
};

export const getSubmarineEvmRefundSignature = (
    id: string,
): Promise<{ signature: Hex }> => getEipRefundSignature(id, SwapType.Submarine);
