import { hex } from "@scure/base";
import {
    type ClaimDetails,
    OutputType,
    SwapTreeSerializer,
    detectSwap,
} from "boltz-core";
import { Buffer } from "buffer";
import type { networks as LiquidNetworks } from "liquidjs-lib";

import {
    getChainSwapClaimDetails,
    getPartialReverseClaimSignature,
    postChainSwapDetails,
} from "../client.ts";
import { formatError } from "../errors.ts";
import { getLogger } from "../logger.ts";
import { utxoSecp } from "./lazy.ts";
import {
    type ECKeys,
    LBTC,
    createMusig,
    hashForWitnessV1,
    tweakMusig,
} from "./musig.ts";
import {
    type UtxoNetwork,
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setCooperativeWitness,
    txToHex,
    txToId,
} from "./transaction.ts";

type LiquidNetwork = (typeof LiquidNetworks)["liquid"];

export type UtxoAsset = "BTC" | "L-BTC";

type SerializedSwapTree = Parameters<
    typeof SwapTreeSerializer.deserializeSwapTree
>[0];

export type PartialSignatureResponse = {
    pubNonce: string;
    partialSignature: string;
};

export type CooperativeSourceClaimInput = {
    asset: UtxoAsset;
    refundKeys: ECKeys;
    sourceSwapTree: SerializedSwapTree;
};

export type ChainSwapUtxoClaimParams = {
    id: string;
    asset: UtxoAsset;
    network: UtxoNetwork;
    serverPublicKey: string;
    swapTree: SerializedSwapTree;
    blindingKey?: string;
    claimKeys: ECKeys;
    preimage: Uint8Array;
    claimAddress: string;
    receiveAmount: number;
    lockupTxHex: string;
    cooperativeSource?: CooperativeSourceClaimInput;
    cooperative?: boolean;
};

export type ChainSwapUtxoClaimResult = {
    transactionHex: string;
    transactionId: string;
    // Value of the claim output, which is `receiveAmount` less any surcharge
    claimedAmount: number;
};

export type ReverseUtxoClaimParams = {
    id: string;
    asset: UtxoAsset;
    network: UtxoNetwork;
    serverPublicKey: string;
    swapTree: SerializedSwapTree;
    blindingKey?: string;
    claimKeys: ECKeys;
    preimage: Uint8Array;
    claimAddress: string;
    receiveAmount: number;
    lockupTxHex: string;
    cooperative?: boolean;
};

const isNotEligibleForCooperativeClaim = (err: unknown): boolean =>
    formatError(err) === "swap not eligible for a cooperative claim";

export const createCooperativeSourceClaimSignature = async (
    id: string,
    input: CooperativeSourceClaimInput,
): Promise<PartialSignatureResponse | undefined> => {
    try {
        const serverClaimDetails = await getChainSwapClaimDetails(id);

        const boltzClaimPublicKey = hex.decode(serverClaimDetails.publicKey);
        const theirClaimKeyAgg = createMusig(
            input.refundKeys,
            boltzClaimPublicKey,
        );
        const tweaked = tweakMusig(
            input.asset,
            theirClaimKeyAgg,
            SwapTreeSerializer.deserializeSwapTree(input.sourceSwapTree).tree,
        );

        const withNonce = tweaked
            .message(hex.decode(serverClaimDetails.transactionHash))
            .generateNonce();

        const aggNonces = withNonce.aggregateNonces([
            [boltzClaimPublicKey, hex.decode(serverClaimDetails.pubNonce)],
        ]);
        const session = aggNonces.initializeSession();
        const signed = session.signPartial();

        return {
            pubNonce: hex.encode(withNonce.publicNonce),
            partialSignature: hex.encode(signed.ourPartialSignature),
        };
    } catch (err) {
        if (isNotEligibleForCooperativeClaim(err)) {
            getLogger().debug(
                `Backend already broadcast their claim for chain swap ${id}`,
            );
            return undefined;
        }
        throw err;
    }
};

const buildAdjustedTaprootClaim = async (params: {
    asset: UtxoAsset;
    network: UtxoNetwork;
    serverPublicKey: string;
    swapTree: SerializedSwapTree;
    blindingKey?: string;
    claimKeys: ECKeys;
    preimage: Uint8Array;
    claimAddress: string;
    receiveAmount: number;
    lockupTxHex: string;
    cooperative: boolean;
}) => {
    const { asset, network } = params;

    const boltzPublicKey = hex.decode(params.serverPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(params.swapTree);
    const keyAgg = createMusig(params.claimKeys, boltzPublicKey);
    const tweaked = tweakMusig(asset, keyAgg, tree.tree);

    const lockupTx = getTransaction(asset).fromHex(params.lockupTxHex);
    const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);
    if (swapOutput === undefined) {
        throw new Error("could not find swap output in lockup transaction");
    }

    const blindingPrivateKey =
        params.blindingKey !== undefined
            ? Buffer.from(params.blindingKey, "hex")
            : undefined;

    const details = [
        {
            ...swapOutput,
            cooperative: params.cooperative,
            swapTree: tree,
            privateKey: params.claimKeys.privateKey,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey,
            internalKey: keyAgg.aggPubkey,
            preimage: params.preimage,
        },
    ] as unknown as (ClaimDetails & { blindingPrivateKey?: Uint8Array })[];

    const decoded = decodeAddress(asset, params.claimAddress, network);
    const { claimTx, claimedAmount } = await createAdjustedClaim(
        asset,
        params.receiveAmount,
        details,
        decoded.script,
        asset === LBTC
            ? (getNetwork(asset, network) as LiquidNetwork)
            : undefined,
        decoded.blindingKey,
    );

    return { claimTx, claimedAmount, details, tweaked, boltzPublicKey };
};

type ClaimBuild = Awaited<ReturnType<typeof buildAdjustedTaprootClaim>>;

type CooperativeClaimContext = {
    withNonce: ReturnType<
        ReturnType<ClaimBuild["tweaked"]["message"]>["generateNonce"]
    >;
    boltzPublicKey: ClaimBuild["boltzPublicKey"];
    claimTx: ClaimBuild["claimTx"];
};

const claimCooperativeUtxo = async (
    params: ChainSwapUtxoClaimParams | ReverseUtxoClaimParams,
    aggregateCooperative: (ctx: CooperativeClaimContext) => Promise<Uint8Array>,
    warnLabel: string,
): Promise<ChainSwapUtxoClaimResult> => {
    const cooperative = params.cooperative ?? true;
    const { asset, network } = params;

    const { claimTx, claimedAmount, details, tweaked, boltzPublicKey } =
        await buildAdjustedTaprootClaim({ ...params, cooperative });

    if (!cooperative) {
        return {
            transactionHex: txToHex(claimTx),
            transactionId: txToId(claimTx),
            claimedAmount,
        };
    }

    try {
        const sigHash = hashForWitnessV1(
            asset,
            getNetwork(asset, network),
            details,
            claimTx,
            0,
        );

        const withNonce = tweaked.message(sigHash).generateNonce();

        setCooperativeWitness(
            claimTx,
            0,
            await aggregateCooperative({ withNonce, boltzPublicKey, claimTx }),
        );

        return {
            transactionHex: txToHex(claimTx),
            transactionId: txToId(claimTx),
            claimedAmount,
        };
    } catch (e) {
        getLogger().warn(warnLabel, e);
        return claimCooperativeUtxo(
            { ...params, cooperative: false },
            aggregateCooperative,
            warnLabel,
        );
    }
};

export const claimChainSwapUtxo = (
    params: ChainSwapUtxoClaimParams,
): Promise<ChainSwapUtxoClaimResult> =>
    claimCooperativeUtxo(
        params,
        async ({ withNonce, boltzPublicKey, claimTx }) => {
            // For a UTXO source, also hand the server our partial signature so
            // it can claim the source cooperatively in the same request.
            const theirSig =
                params.cooperativeSource !== undefined
                    ? await createCooperativeSourceClaimSignature(
                          params.id,
                          params.cooperativeSource,
                      )
                    : undefined;

            const theirPartial = await postChainSwapDetails(
                params.id,
                hex.encode(params.preimage),
                theirSig,
                {
                    index: 0,
                    transaction: txToHex(claimTx),
                    pubNonce: hex.encode(withNonce.publicNonce),
                },
            );

            const aggNonces = withNonce.aggregateNonces([
                [boltzPublicKey, hex.decode(theirPartial.pubNonce)],
            ]);
            const session = aggNonces.initializeSession();
            const withTheirs = session.addPartial(
                boltzPublicKey,
                hex.decode(theirPartial.partialSignature),
            );
            return withTheirs.signPartial().aggregatePartials();
        },
        "Uncooperative Taproot claim because",
    );

export const claimReverseUtxo = (
    params: ReverseUtxoClaimParams,
): Promise<ChainSwapUtxoClaimResult> =>
    claimCooperativeUtxo(
        params,
        async ({ withNonce, boltzPublicKey, claimTx }) => {
            const boltzSig = await getPartialReverseClaimSignature(
                params.id,
                params.preimage,
                withNonce.publicNonce,
                txToHex(claimTx),
                0,
            );

            const aggNonces = withNonce.aggregateNonces([
                [boltzPublicKey, boltzSig.pubNonce],
            ]);
            const session = aggNonces.initializeSession();
            return session
                .signPartial()
                .addPartial(boltzPublicKey, boltzSig.signature)
                .aggregatePartials();
        },
        "Uncooperative reverse Taproot claim because",
    );

// Spending blinded inputs into an unconfidential destination leaves no blinded
// output, so boltz-core injects a blinded 1 sat OP_RETURN and funds it by
// paying `fee - 1`. That sat, plus what the extra output costs at Liquid's
// 0.1 sat/vbyte floor: it adds 45 discounted vbytes, and because the floor
// truncates, `floor((v + 45) / 10) - floor(v / 10)` is 4 or 5 depending on
// `v % 10`. 6 is the minimum that covers every alignment, not a padded value.
export const liquidUnconfidentialClaimExtra = 6;

// The surcharge comes out of the claim output, so the amount that lands is
// `receiveAmount` minus this. Returns 0 for an address that cannot be decoded:
// the claim would throw before reaching the surcharge anyway.
export const unconfidentialClaimSurcharge = (
    asset: string,
    claimAddress: string,
    network: UtxoNetwork,
): number => {
    if (asset !== LBTC) {
        return 0;
    }

    try {
        return decodeAddress(asset, claimAddress, network).blindingKey ===
            undefined
            ? liquidUnconfidentialClaimExtra
            : 0;
    } catch {
        return 0;
    }
};

const needsBlindedOpReturn = (
    asset: string,
    claimDetails: { blindingPrivateKey?: Uint8Array }[],
    blindingKey?: Buffer,
) =>
    asset === LBTC &&
    blindingKey === undefined &&
    claimDetails.some((details) => details.blindingPrivateKey !== undefined);

const createAdjustedClaim = async (
    asset: string,
    receiveAmount: number,
    claimDetails: (ClaimDetails & { blindingPrivateKey?: Uint8Array })[],
    destination: Uint8Array,
    liquidNetwork?: LiquidNetwork,
    blindingKey?: Buffer,
) => {
    if (receiveAmount === 0) {
        throw new Error("amount to be received is 0");
    }

    // Ensure secp256k1-zkp is initialized for Liquid transaction construction.
    if (asset === LBTC) {
        await utxoSecp.get();
    }

    let inputSum = 0;
    for (const details of claimDetails) {
        inputSum += await getOutputAmount(asset, details as never);
    }

    // Comes out of the claim output: boltz-core sizes it as `inputSum - fee`
    const extra = needsBlindedOpReturn(asset, claimDetails, blindingKey)
        ? liquidUnconfidentialClaimExtra
        : 0;

    const feeBudget = Math.floor(inputSum - receiveAmount) + extra;
    if (feeBudget < extra) {
        throw new Error(
            `cannot construct claim transaction: receiveAmount ${receiveAmount} exceeds available input sum ${inputSum}`,
        );
    }
    if (extra > 0) {
        if (inputSum - feeBudget <= 0) {
            throw new Error(
                `cannot construct claim transaction: receiveAmount ${receiveAmount} does not cover the ${extra} sat surcharge of an unconfidential destination`,
            );
        }

        getLogger().debug(
            `Reserved ${extra} sat for the blinded OP_RETURN of an unconfidential ${asset} claim`,
        );
    }
    const constructClaimTransaction = getConstructClaimTransaction(asset);

    return {
        claimTx: constructClaimTransaction(
            claimDetails,
            destination,
            feeBudget,
            true,
            liquidNetwork,
            blindingKey,
        ),
        claimedAmount: receiveAmount - extra,
    };
};
