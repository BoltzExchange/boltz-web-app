import { type RestorableSwap, getRestorableSwaps } from "boltz-swaps/client";
import { type SwapContract, isEmptyPreimageHash } from "boltz-swaps/evm";
import { RskRescueMode } from "boltz-swaps/types";
import log from "loglevel";

import { config } from "../../config";
import { RBTC, TBTC, WBTC } from "../../consts/Assets";
import { paginationLimit } from "../../consts/Pagination";
import { formatError } from "../../utils/errors";
import { RescueAction } from "../../utils/rescue";
import { type RescueFile, getXpub } from "../../utils/rescueFile";
import type { SomeSwap } from "../../utils/swapCreator";
import {
    type SwapMetadataLocalFields,
    hydrateRestorableSwapsMetadata,
    normalizeCommitmentMatchId,
} from "../../utils/swapMetadata";
import { mapSwap } from "../RefundRescue";
import {
    type EvmRescueResult,
    type EvmScanTarget,
    RescueResultSource,
    type RestoredEvmSwap,
    type UnifiedRescueResult,
} from "./types";

const rescueActionPriority: Record<RescueAction, number> = {
    [RescueAction.Claim]: 0,
    [RescueAction.Refund]: 0,
    [RescueAction.Pending]: 1,
    [RescueAction.Failed]: 2,
    [RescueAction.Successful]: 2,
};

const resultSourcePriority: Record<RescueResultSource, number> = {
    [RescueResultSource.Restore]: 0,
    [RescueResultSource.Evm]: 1,
    [RescueResultSource.Sweep]: 2,
};

export const arbitrumRescueAssets = [TBTC, WBTC] as const;

export const normalizeEvmId = (value: string | undefined): string =>
    value?.toLowerCase().replace(/^0x/, "") ?? "";

const hasUsablePreimageHash = (value: string | undefined) =>
    normalizeEvmId(value) !== "" && !isEmptyPreimageHash(value);

type RestoredEvmMatchReason =
    | "evm-claim-transaction"
    | "refund-transaction"
    | "commitment-match-id"
    | "preimage-hash"
    | "claim-address";

type RestoredEvmMatch = {
    restoredSwap: RestoredEvmSwap;
    reason: RestoredEvmMatchReason;
};

const getEvmResultKey = (swap: EvmRescueResult) =>
    [
        swap.action,
        swap.asset,
        normalizeEvmId(swap.transactionHash),
        normalizeEvmId(swap.preimageHash),
    ].join(":");

export const mergeEvmRescueResults = (
    current: EvmRescueResult[],
    next: EvmRescueResult[],
): EvmRescueResult[] => {
    const merged = new Map<string, EvmRescueResult>();

    for (const swap of current) {
        merged.set(getEvmResultKey(swap), swap);
    }

    for (const swap of next) {
        const key = getEvmResultKey(swap);
        const existing = merged.get(key);
        merged.set(key, {
            ...existing,
            ...swap,
            restoredSwap: swap.restoredSwap ?? existing?.restoredSwap,
            dex: swap.dex ?? existing?.dex,
            bridge: swap.bridge ?? existing?.bridge,
            preimage: swap.preimage ?? existing?.preimage,
            commitmentMatchId:
                swap.commitmentMatchId ?? existing?.commitmentMatchId,
        });
    }

    return [...merged.values()];
};

const hasPreimageHash = (swap: RestorableSwap): swap is RestoredEvmSwap =>
    swap.preimageHash !== undefined;

const getRestoredEvmMatchDetails = (
    swap: EvmRescueResult,
    restoredSwaps: RestoredEvmSwap[],
): RestoredEvmMatch | undefined => {
    const txHash = normalizeEvmId(swap.transactionHash);
    const preimageHash = normalizeEvmId(swap.preimageHash);
    const claimAddress = normalizeEvmId(swap.claimAddress);
    const commitmentMatchId = normalizeCommitmentMatchId(
        swap.commitmentMatchId,
    );

    for (const restored of restoredSwaps) {
        if (
            txHash !== "" &&
            normalizeEvmId(restored.evmClaimDetails?.transaction?.id) === txHash
        ) {
            return {
                restoredSwap: restored,
                reason: "evm-claim-transaction",
            };
        }

        if (
            txHash !== "" &&
            normalizeEvmId(restored.refundDetails?.transaction?.id) === txHash
        ) {
            return {
                restoredSwap: restored,
                reason: "refund-transaction",
            };
        }

        if (
            hasUsablePreimageHash(swap.preimageHash) &&
            normalizeEvmId(restored.preimageHash) === preimageHash
        ) {
            return {
                restoredSwap: restored,
                reason: "preimage-hash",
            };
        }
    }

    if (commitmentMatchId !== undefined) {
        const commitmentMatches = restoredSwaps.filter(
            (restored) =>
                normalizeCommitmentMatchId(restored.commitmentMatch?.id) ===
                commitmentMatchId,
        );

        const commitmentMatch =
            commitmentMatches.length === 1
                ? commitmentMatches[0]
                : undefined;

        if (commitmentMatch !== undefined) {
            return {
                restoredSwap: commitmentMatch,
                reason: "commitment-match-id",
            };
        }
    }

    if (claimAddress === "") {
        return undefined;
    }

    const addressMatches = restoredSwaps.filter(
        (restored) =>
            normalizeEvmId(restored.evmClaimDetails?.claimAddress) ===
            claimAddress,
    );

    const addressMatch =
        addressMatches.length === 1 ? addressMatches[0] : undefined;

    return addressMatch === undefined
        ? undefined
        : {
              restoredSwap: addressMatch,
              reason: "claim-address",
          };
};

export const getRestoredEvmMatch = (
    swap: EvmRescueResult,
    restoredSwaps: RestoredEvmSwap[],
): RestoredEvmSwap | undefined =>
    getRestoredEvmMatchDetails(swap, restoredSwaps)?.restoredSwap;

export const enrichEvmRescueResults = (
    swaps: EvmRescueResult[],
    restoredSwaps: RestoredEvmSwap[],
): EvmRescueResult[] =>
    swaps.map((swap) => {
        const match = getRestoredEvmMatchDetails(swap, restoredSwaps);
        if (match === undefined) {
            return swap;
        }

        const restoredSwap = match.restoredSwap;
        log.warn("[external-rescue-diagnostic] EVM restore metadata match", {
            action: swap.action,
            asset: swap.asset,
            transactionHash: swap.transactionHash,
            preimageHash: swap.preimageHash,
            commitmentMatchId: swap.commitmentMatchId,
            amount: swap.amount.toString(),
            claimAddress: swap.claimAddress,
            refundAddress: swap.refundAddress,
            matchedId: restoredSwap.id,
            reason: match.reason,
            restoredFrom: restoredSwap.from,
            restoredTo: restoredSwap.to,
            restoredPreimageHash: restoredSwap.preimageHash,
            evmClaimDetails: restoredSwap.evmClaimDetails,
            dex: restoredSwap.dex,
            bridge: restoredSwap.bridge,
        });

        return {
            ...swap,
            restoredSwap,
            dex: restoredSwap.dex,
            bridge: restoredSwap.bridge,
        };
    });

export const mapRestoredEvmSwaps = async (
    swaps: RestorableSwap[],
    mnemonic: string,
): Promise<RestoredEvmSwap[]> => {
    return await hydrateRestorableSwapsMetadata(
        swaps.filter(hasPreimageHash),
        mnemonic,
    );
};

const getRestoredEvmSwapKey = (swap: RestoredEvmSwap) =>
    normalizeEvmId(swap.preimageHash) || swap.id;

export const mergeRestoredEvmSwaps = (
    current: RestoredEvmSwap[],
    next: RestoredEvmSwap[],
): RestoredEvmSwap[] => {
    const merged = new Map<string, RestoredEvmSwap>();

    for (const swap of current) {
        merged.set(getRestoredEvmSwapKey(swap), swap);
    }

    for (const swap of next) {
        const key = getRestoredEvmSwapKey(swap);
        const existing = merged.get(key);
        merged.set(key, {
            ...existing,
            ...swap,
            evmClaimDetails: swap.evmClaimDetails ?? existing?.evmClaimDetails,
            dex: swap.dex ?? existing?.dex,
            bridge: swap.bridge ?? existing?.bridge,
            commitmentMatch: swap.commitmentMatch ?? existing?.commitmentMatch,
        });
    }

    return [...merged.values()];
};

export const getSwapDate = (swap: {
    date?: number;
    createdAt?: number;
}): number => {
    if (swap.date !== undefined) {
        return swap.date;
    }

    return (swap.createdAt ?? 0) * 1_000;
};

export const getEvmRescueAction = (swap: EvmRescueResult) => {
    if (swap.action === RskRescueMode.Claim) {
        return RescueAction.Claim;
    }

    if (isEmptyPreimageHash(swap.preimageHash)) {
        return RescueAction.Refund;
    }

    if (
        swap.currentHeight !== undefined &&
        swap.timelock <= swap.currentHeight
    ) {
        return RescueAction.Refund;
    }

    return RescueAction.Pending;
};

export const sortUnifiedResults = (results: UnifiedRescueResult[]) =>
    [...results].sort((a, b) => {
        const aPriority = rescueActionPriority[a.action];
        const bPriority = rescueActionPriority[b.action];

        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }

        const sourcePriority =
            resultSourcePriority[a.source] - resultSourcePriority[b.source];
        if (sourcePriority !== 0) {
            return sourcePriority;
        }

        return b.sortValue - a.sortValue;
    });

export const fetchPaginatedRestorableSwaps = async (
    rescueFile: RescueFile,
    setLoadedSwaps: (count: number) => void,
    signal: AbortSignal,
) => {
    let startIndex = 0;
    let loaded = 0;
    const restorableSwaps: RestorableSwap[] = [];

    setLoadedSwaps(0);

    while (true) {
        if (signal.aborted) {
            break;
        }

        try {
            const res = await getRestorableSwaps(
                getXpub(rescueFile),
                {
                    startIndex,
                    limit: paginationLimit,
                },
                signal,
            );

            if (signal.aborted) {
                break;
            }

            if (res.length === 0) {
                break;
            }

            restorableSwaps.push(...res);
            loaded += res.length;
            setLoadedSwaps(loaded);

            startIndex += paginationLimit;
        } catch (e) {
            if (signal.aborted) {
                break;
            }

            log.error("failed to get restorable swaps:", formatError(e));
            setLoadedSwaps(0);
            throw formatError(e);
        }
    }

    return restorableSwaps;
};

type HydratedRestorableSwap = RestorableSwap & SwapMetadataLocalFields;

export const mapHydratedRestorableSwaps = (
    swaps: HydratedRestorableSwap[],
): Partial<SomeSwap>[] =>
    swaps
        .map(mapSwap)
        .filter((swap): swap is Partial<SomeSwap> => swap !== undefined);

export const filterHydratedEvmSwaps = (
    swaps: HydratedRestorableSwap[],
): RestoredEvmSwap[] => swaps.filter(hasPreimageHash);

export const mapRestorableSwaps = async (
    swaps: RestorableSwap[],
    mnemonic: string,
): Promise<Partial<SomeSwap>[]> =>
    mapHydratedRestorableSwaps(
        await hydrateRestorableSwapsMetadata(swaps, mnemonic),
    );

export const getEvmScanTargets = (
    getEtherSwap: (asset: string) => SwapContract,
    getErc20Swap: (asset: string) => SwapContract,
    action: RskRescueMode,
    hasRescueFile: boolean,
): EvmScanTarget[] => {
    const targets: EvmScanTarget[] = [];

    const rskEndpoint = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (rskEndpoint) {
        targets.push({
            asset: RBTC,
            providerUrl: rskEndpoint,
            contract: getEtherSwap(RBTC),
        });
    } else {
        log.warn("rsk log endpoint not set");
    }

    const skipArbitrum = action === RskRescueMode.Refund && !hasRescueFile;

    const arbEndpoint = import.meta.env.VITE_ARBITRUM_LOG_SCAN_ENDPOINT;
    if (
        !skipArbitrum &&
        arbEndpoint &&
        arbitrumRescueAssets.some(
            (asset) =>
                config.assets?.[asset]?.contracts?.deployHeight !== undefined,
        )
    ) {
        targets.push(
            ...arbitrumRescueAssets
                .filter(
                    (asset) =>
                        config.assets?.[asset]?.contracts?.deployHeight !==
                        undefined,
                )
                .map((asset) => ({
                    asset,
                    providerUrl: arbEndpoint,
                    scanInterval: 100_000,
                    contract: getErc20Swap(asset),
                })),
        );
    } else if (!arbEndpoint) {
        log.warn("arbitrum log endpoint not set");
    }

    return targets;
};
