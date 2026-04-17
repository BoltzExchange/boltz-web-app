import { makePersisted } from "@solid-primitives/storage";
import log from "loglevel";
import { createSignal } from "solid-js";

import { BridgeKind } from "../configs/base";
import { LN, RBTC, isEvmAsset } from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import {
    type BridgeDetail,
    GasAbstractionType,
    type SomeSwap,
} from "./swapCreator";

export const latestStorageVersion = 7;

const storageVersionKey = "version";

type ParsedGasAbstraction = {
    lockup: GasAbstractionType;
    claim: GasAbstractionType;
};

const toUniformGasAbstraction = (
    gasAbstraction: GasAbstractionType,
): ParsedGasAbstraction => ({
    lockup: gasAbstraction,
    claim: gasAbstraction,
});

const noGasAbstraction = (): ParsedGasAbstraction =>
    toUniformGasAbstraction(GasAbstractionType.None);

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

export const migrateSwapGasAbstraction = (
    swap: Record<string, unknown>,
): SomeSwap => {
    if (swap.gasAbstraction !== undefined) {
        return swap as SomeSwap;
    }

    let gasAbstraction = noGasAbstraction();
    if (
        swap.useGasAbstraction === true &&
        typeof swap.assetReceive === "string"
    ) {
        gasAbstraction =
            swap.assetReceive === RBTC
                ? toUniformGasAbstraction(GasAbstractionType.RifRelay)
                : isEvmAsset(swap.assetReceive)
                  ? toUniformGasAbstraction(GasAbstractionType.Signer)
                  : noGasAbstraction();
    }

    const migratedSwap = { ...swap };
    delete migratedSwap.useGasAbstraction;
    return {
        ...migratedSwap,
        gasAbstraction,
    } as SomeSwap;
};

const parseGasAbstractionType = (
    gasAbstraction: unknown,
): GasAbstractionType | undefined => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay:
        case GasAbstractionType.Signer:
            return gasAbstraction;

        default:
            return undefined;
    }
};

const parseGasAbstraction = (gasAbstraction: unknown) => {
    const legacyGasAbstraction = parseGasAbstractionType(gasAbstraction);
    if (legacyGasAbstraction !== undefined) {
        return toUniformGasAbstraction(legacyGasAbstraction);
    }

    if (typeof gasAbstraction !== "object" || gasAbstraction === null) {
        return undefined;
    }

    const lockup = parseGasAbstractionType(
        (gasAbstraction as { lockup?: unknown }).lockup,
    );
    const claim = parseGasAbstractionType(
        (gasAbstraction as { claim?: unknown }).claim,
    );
    if (lockup === undefined || claim === undefined) {
        return undefined;
    }

    return {
        lockup,
        claim,
    };
};

const deriveLockupGasAbstraction = (
    assetSend: unknown,
): GasAbstractionType | undefined => {
    if (typeof assetSend !== "string") {
        return undefined;
    }

    if (assetSend === RBTC) {
        return GasAbstractionType.None;
    }

    return isEvmAsset(assetSend)
        ? GasAbstractionType.Signer
        : GasAbstractionType.None;
};

export const migrateSwapGasAbstractionShape = (
    swap: Record<string, unknown>,
): SomeSwap => {
    const claim = parseGasAbstraction(swap.gasAbstraction)?.claim;
    const lockup = deriveLockupGasAbstraction(swap.assetSend);

    return {
        ...swap,
        gasAbstraction:
            claim !== undefined && lockup !== undefined
                ? {
                      claim,
                      lockup,
                  }
                : noGasAbstraction(),
    } as SomeSwap;
};

const normalizeSwapPosition = (position: unknown): SwapPosition | undefined => {
    switch (position) {
        case "before":
        case "pre":
            return SwapPosition.Pre;

        case "after":
        case "post":
            return SwapPosition.Post;

        default:
            return undefined;
    }
};

export const migrateSwapDexPositionShape = (swap: SomeSwap): SomeSwap => {
    const position = normalizeSwapPosition(swap.dex?.position);
    if (position === undefined) {
        return swap as SomeSwap;
    }
    swap.dex.position = position;
    return swap as SomeSwap;
};

const migrateStorageGasAbstraction = async (swapsForage: LocalForage) => {
    const swaps = await swapsForage.keys();

    for (const swapId of swaps) {
        const swap = await swapsForage.getItem<Record<string, unknown>>(swapId);
        await swapsForage.setItem(swapId, migrateSwapGasAbstraction(swap));
    }

    return swaps.length;
};

const migrateStorageGasAbstractionShape = async (swapsForage: LocalForage) => {
    const swaps = await swapsForage.keys();

    for (const swapId of swaps) {
        const swap = await swapsForage.getItem<Record<string, unknown>>(swapId);
        await swapsForage.setItem(swapId, migrateSwapGasAbstractionShape(swap));
    }

    return swaps.length;
};

const migrateStorageDexPositionShape = async (swapsForage: LocalForage) => {
    const swaps = await swapsForage.keys();

    for (const swapId of swaps) {
        const swap = await swapsForage.getItem<Record<string, unknown>>(swapId);
        await swapsForage.setItem(
            swapId,
            migrateSwapDexPositionShape(swap as SomeSwap),
        );
    }

    return swaps.length;
};

export const migrateSwapBridgeShape = (
    swap: Record<string, unknown>,
): SomeSwap => {
    const swapWithoutLegacyOft = { ...swap };
    delete swapWithoutLegacyOft.oft;
    const bridge =
        (swap.bridge as
            | (Record<string, unknown> & {
                  kind?: string;
                  sourceAsset?: string;
                  destinationAsset?: string;
                  destinationChainId?: number;
                  position?: string;
                  pre?: Record<string, unknown>;
                  post?: Record<string, unknown>;
                  txHash?: string;
              })
            | undefined) ??
        (swap.oft as
            | (Record<string, unknown> & {
                  sourceAsset?: string;
                  destinationAsset?: string;
                  destinationChainId?: number;
                  position?: string;
                  pre?: Record<string, unknown>;
                  post?: Record<string, unknown>;
                  txHash?: string;
              })
            | undefined);

    if (bridge === undefined) {
        return swapWithoutLegacyOft as SomeSwap;
    }

    const toBridgeDetail = (
        detail: Record<string, unknown> | undefined,
        position: SwapPosition,
    ): BridgeDetail | undefined => {
        if (
            detail === undefined ||
            typeof detail.sourceAsset !== "string" ||
            typeof detail.destinationAsset !== "string"
        ) {
            return undefined;
        }

        return {
            kind: BridgeKind.Oft,
            sourceAsset: detail.sourceAsset,
            destinationAsset: detail.destinationAsset,
            position,
            ...(typeof detail.txHash === "string"
                ? { txHash: detail.txHash }
                : {}),
        };
    };

    const migratedBridge =
        typeof bridge.sourceAsset === "string" &&
        typeof bridge.destinationAsset === "string"
            ? {
                  kind:
                      (bridge.kind as BridgeKind | undefined) ?? BridgeKind.Oft,
                  sourceAsset: bridge.sourceAsset,
                  destinationAsset: bridge.destinationAsset,
                  position:
                      bridge.position === SwapPosition.Pre
                          ? SwapPosition.Pre
                          : SwapPosition.Post,
                  ...(typeof bridge.txHash === "string"
                      ? { txHash: bridge.txHash }
                      : {}),
              }
            : (toBridgeDetail(bridge.pre, SwapPosition.Pre) ??
              toBridgeDetail(bridge.post, SwapPosition.Post));

    return {
        ...swapWithoutLegacyOft,
        bridge: migratedBridge,
    } as SomeSwap;
};

const migrateStorageBridgeShape = async (swapsForage: LocalForage) => {
    const swaps = await swapsForage.keys();

    for (const swapId of swaps) {
        const swap = await swapsForage.getItem<Record<string, unknown>>(swapId);
        await swapsForage.setItem(swapId, migrateSwapBridgeShape(swap));
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
            const migratedSwaps = await migrateStorageBridgeShape(swapsForage);
            log.info(`Migrated OFT shape for ${migratedSwaps} swaps`);

            await paramsForage.setItem(storageVersionKey, 4);
            await migrateLocalForage(paramsForage, swapsForage);
            break;
        }

        case 4: {
            log.info(`Migrating gas abstraction shape`);
            const migratedSwaps =
                await migrateStorageGasAbstractionShape(swapsForage);
            log.info(
                `Migrated gas abstraction shape for ${migratedSwaps} swaps`,
            );

            await paramsForage.setItem(storageVersionKey, 5);
            await migrateLocalForage(paramsForage, swapsForage);
            break;
        }

        case 5: {
            log.info(`Migrating DEX hop position wording`);
            const migratedSwaps =
                await migrateStorageDexPositionShape(swapsForage);
            log.info(
                `Migrated DEX hop position wording for ${migratedSwaps} swaps`,
            );

            await paramsForage.setItem(storageVersionKey, 6);
            await migrateLocalForage(paramsForage, swapsForage);
            break;
        }

        case 6: {
            log.info(`Migrating bridge storage format`);
            const migratedSwaps = await migrateStorageBridgeShape(swapsForage);
            log.info(
                `Migrated bridge storage shape for ${migratedSwaps} swaps`,
            );

            await paramsForage.setItem(storageVersionKey, 7);
            await migrateLocalForage(paramsForage, swapsForage);
            break;
        }
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
