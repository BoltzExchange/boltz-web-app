import { makePersisted } from "@solid-primitives/storage";
import log from "loglevel";
import { createSignal } from "solid-js";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { SomeSwap } from "./swapCreator";

export const latestStorageVersion = 1;

const storageVersionKey = "version";

const migrateSwapsFromLocalStorage = async (swapsForage: LocalForage) => {
    const [localStorageSwaps, setLocalStorageSwaps] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal([], {
            // Because arrays are the same object when changed,
            // we have to override the equality checker
            equals: () => false,
        }),
        {
            name: "swaps",
        },
    );

    for (const swap of localStorageSwaps()) {
        await swapsForage.setItem(swap.id, swap);
    }

    const migratedSwapCount = localStorageSwaps().length;
    setLocalStorageSwaps([]);

    return migratedSwapCount;
};

export const migrateSwapToChainSwapFormat = (
    swap: Record<string, unknown>,
): SomeSwap => {
    if (swap.reverse) {
        return {
            ...swap,
            assetSend: LN,
            type: SwapType.Reverse,
            assetReceive: swap.asset,
            claimPrivateKey: swap.privateKey,
        } as SomeSwap;
    } else {
        return {
            ...swap,
            assetReceive: LN,
            assetSend: swap.asset,
            type: SwapType.Submarine,
            refundPrivateKey: swap.privateKey,
        } as SomeSwap;
    }
};

const migrateStorageToChainSwaps = async (swapsForage: LocalForage) => {
    const swaps = await swapsForage.keys();

    for (const swapId of swaps) {
        const swap = await swapsForage.getItem<Record<string, unknown>>(swapId);
        await swapsForage.setItem(swapId, migrateSwapToChainSwapFormat(swap));
    }

    return swaps.length;
};

const migrateLocalForage = async (
    paramsForage: LocalForage,
    swapsForage: LocalForage,
) => {
    const storageVersion = await paramsForage.getItem<number | null>(
        storageVersionKey,
    );
    switch (storageVersion) {
        case latestStorageVersion:
            log.debug(
                `Storage already on latest version: ${latestStorageVersion}`,
            );
            return;

        case null: {
            log.info(`Migrating storage to chain swaps format`);
            const migratedSwaps = await migrateStorageToChainSwaps(swapsForage);
            log.info(`Migrated ${migratedSwaps} to chain swap storage format`);

            await paramsForage.setItem(storageVersionKey, 1);
            await migrateLocalForage(paramsForage, swapsForage);
        }
    }
};

export const migrateBackupFile = (
    version: number,
    swaps: Record<string, unknown>[],
): SomeSwap[] => {
    switch (version) {
        case latestStorageVersion:
            log.debug(
                `Backup file already at latest version: ${latestStorageVersion}`,
            );
            return swaps as SomeSwap[];

        case 0: {
            log.debug(
                `Migrating backup file to chain swap version: ${version + 1}`,
            );
            return migrateBackupFile(
                version + 1,
                swaps.map((swap) => migrateSwapToChainSwapFormat(swap)),
            );
        }

        default:
            throw `invalid backup file version: ${version}`;
    }
};

export const migrateStorage = async (
    paramsForage: LocalForage,
    swapsForage: LocalForage,
) => {
    // Always check local storage for leftovers
    const localStorageMigratedCount =
        await migrateSwapsFromLocalStorage(swapsForage);
    if (localStorageMigratedCount > 0) {
        log.info(
            `Migrated ${localStorageMigratedCount} swaps from local storage`,
        );
    }

    await migrateLocalForage(paramsForage, swapsForage);
};
