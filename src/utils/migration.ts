import { makePersisted } from "@solid-primitives/storage";
import log from "loglevel";
import { createSignal } from "solid-js";

import { LN, RBTC, isEvmAsset } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import {
    GasAbstractionType,
    type OftDetail,
    OftPosition,
    type SomeSwap,
} from "./swapCreator";

export const latestStorageVersion = 4;

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

const migrateSwapGasAbstraction = (swap: Record<string, unknown>): SomeSwap => {
    if (swap.gasAbstraction !== undefined) {
        return swap as SomeSwap;
    }

    let gasAbstraction = GasAbstractionType.None;
    if (
        swap.useGasAbstraction === true &&
        typeof swap.assetReceive === "string"
    ) {
        gasAbstraction =
            swap.assetReceive === RBTC
                ? GasAbstractionType.RifRelay
                : isEvmAsset(swap.assetReceive)
                  ? GasAbstractionType.Signer
                  : GasAbstractionType.None;
    }

    const migratedSwap = { ...swap };
    delete migratedSwap.useGasAbstraction;
    return {
        ...migratedSwap,
        gasAbstraction,
    } as SomeSwap;
};

const migrateStorageGasAbstraction = async (swapsForage: LocalForage) => {
    const swaps = await swapsForage.keys();

    for (const swapId of swaps) {
        const swap = await swapsForage.getItem<Record<string, unknown>>(swapId);
        await swapsForage.setItem(swapId, migrateSwapGasAbstraction(swap));
    }

    return swaps.length;
};

const migrateSwapOftShape = (swap: Record<string, unknown>): SomeSwap => {
    const oft = swap.oft as
        | (Record<string, unknown> & {
              sourceAsset?: string;
              destinationAsset?: string;
              destinationChainId?: number;
              position?: string;
              pre?: Record<string, unknown>;
              post?: Record<string, unknown>;
          })
        | undefined;

    if (oft === undefined) {
        return swap as SomeSwap;
    }

    const toOftDetail = (
        detail: Record<string, unknown> | undefined,
        position: OftPosition,
    ): OftDetail | undefined => {
        if (
            detail === undefined ||
            typeof detail.sourceAsset !== "string" ||
            typeof detail.destinationAsset !== "string"
        ) {
            return undefined;
        }

        return {
            sourceAsset: detail.sourceAsset,
            destinationAsset: detail.destinationAsset,
            position,
        };
    };

    const migratedOft =
        typeof oft.sourceAsset === "string" &&
        typeof oft.destinationAsset === "string"
            ? {
                  sourceAsset: oft.sourceAsset,
                  destinationAsset: oft.destinationAsset,
                  position:
                      oft.position === OftPosition.Pre
                          ? OftPosition.Pre
                          : OftPosition.Post,
              }
            : (toOftDetail(oft.pre, OftPosition.Pre) ??
              toOftDetail(oft.post, OftPosition.Post));

    return {
        ...swap,
        oft: migratedOft,
    } as SomeSwap;
};

const migrateStorageOftShape = async (swapsForage: LocalForage) => {
    const swaps = await swapsForage.keys();

    for (const swapId of swaps) {
        const swap = await swapsForage.getItem<Record<string, unknown>>(swapId);
        await swapsForage.setItem(swapId, migrateSwapOftShape(swap));
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
            break;
        }

        case 1: {
            log.info(`Cleaning up legacy referral storage`);
            localStorage.removeItem("ref");

            await paramsForage.setItem(storageVersionKey, 2);
            await migrateLocalForage(paramsForage, swapsForage);
            break;
        }

        case 2: {
            log.info(`Migrating gas abstraction storage format`);
            const migratedSwaps =
                await migrateStorageGasAbstraction(swapsForage);
            log.info(`Migrated gas abstraction for ${migratedSwaps} swaps`);

            await paramsForage.setItem(storageVersionKey, 3);
            await migrateLocalForage(paramsForage, swapsForage);
            break;
        }

        case 3: {
            log.info(`Migrating OFT storage format`);
            const migratedSwaps = await migrateStorageOftShape(swapsForage);
            log.info(`Migrated OFT shape for ${migratedSwaps} swaps`);

            await paramsForage.setItem(storageVersionKey, 4);
            await migrateLocalForage(paramsForage, swapsForage);
            break;
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

        case 1:
            return migrateBackupFile(version + 1, swaps);

        case 2:
            return migrateBackupFile(
                version + 1,
                swaps.map((swap) => migrateSwapGasAbstraction(swap)),
            );

        case 3:
            return migrateBackupFile(
                version + 1,
                swaps.map((swap) => migrateSwapOftShape(swap)),
            );

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
