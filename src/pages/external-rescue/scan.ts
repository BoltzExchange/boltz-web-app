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
import { decryptSwapMetadata } from "../../utils/swapMetadata";
import { mapSwap } from "../RefundRescue";
import {
    type EvmRescueResult,
    type EvmScanTarget,
    RescueResultSource,
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

export const mapRestorableSwaps = async (
    swaps: RestorableSwap[],
    mnemonic: string,
): Promise<Partial<SomeSwap>[]> => {
    const mapped = await Promise.all(
        swaps.map(async (swap) => {
            const base = mapSwap(swap);
            if (base === undefined || swap.metadata === undefined) {
                return base;
            }

            try {
                const metadata = await decryptSwapMetadata(
                    mnemonic,
                    swap.metadata,
                );
                return {
                    ...base,
                    ...metadata,
                };
            } catch (e) {
                log.warn(
                    `failed to decrypt metadata for swap ${swap.id}, falling back to on-chain assets:`,
                    formatError(e),
                );
                return base;
            }
        }),
    );

    return mapped.filter(
        (swap): swap is Partial<SomeSwap> => swap !== undefined,
    );
};

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
