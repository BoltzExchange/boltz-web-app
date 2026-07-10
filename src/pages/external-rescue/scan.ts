import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { type RestorableSwap, getRestorableSwaps } from "boltz-swaps/client";
import {
    type SwapContract,
    isEmptyPreimageHash,
    satsToAssetAmount,
} from "boltz-swaps/evm";
import { type AssetType, RskRescueMode, SwapPosition } from "boltz-swaps/types";
import log from "loglevel";
import { type Hex, getAddress, zeroAddress } from "viem";

import { config } from "../../config";
import { RBTC, TBTC, WBTC } from "../../consts/Assets";
import { paginationLimit } from "../../consts/Pagination";
import { formatError } from "../../utils/errors";
import { fetcher } from "../../utils/helper";
import { RescueAction } from "../../utils/rescue";
import {
    evmAccountFromPrivateKey,
    mnemonicToHDKey,
} from "../../utils/rescueDerivation";
import {
    type RescueFile,
    derivePreimageFromRescueKey,
    getPathGasAbstraction,
    getXpub,
} from "../../utils/rescueFile";
import type { SomeSwap } from "../../utils/swapCreator";
import {
    type SwapMetadataLocalFields,
    hydrateRestorableSwapsMetadata,
} from "../../utils/swapMetadata";
import { mapSwap } from "../RefundRescue";
import {
    type EvmRescueResult,
    type EvmScanTarget,
    RescueResultSource,
    type RestorableEvmClaimDetails,
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

const getRestorableSwapKey = (swap: RestorableSwap): string => swap.id;

export const mergeRestorableSwaps = (
    ...swapGroups: RestorableSwap[][]
): RestorableSwap[] => {
    const merged = new Map<string, RestorableSwap>();

    for (const swaps of swapGroups) {
        for (const swap of swaps) {
            const existing = merged.get(getRestorableSwapKey(swap));
            merged.set(getRestorableSwapKey(swap), {
                ...existing,
                ...swap,
                metadata: swap.metadata ?? existing?.metadata,
                claimDetails: swap.claimDetails ?? existing?.claimDetails,
                refundDetails: swap.refundDetails ?? existing?.refundDetails,
                evmClaimDetails:
                    swap.evmClaimDetails ?? existing?.evmClaimDetails,
            });
        }
    }

    return [...merged.values()];
};

type RestoredEvmMatchReason =
    | "metadata-lockup-transaction"
    | "metadata-commitment-transaction"
    | "restore-claim-transaction";

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
        // Restore-derived results carry placeholder blockNumber/amount/
        // refundAddress; scan values must win regardless of arrival order.
        merged.set(key, {
            ...existing,
            ...swap,
            restoredSwap: swap.restoredSwap ?? existing?.restoredSwap,
            dex: swap.dex ?? existing?.dex,
            bridge: swap.bridge ?? existing?.bridge,
            preimage: swap.preimage ?? existing?.preimage,
            blockNumber:
                swap.blockNumber || (existing?.blockNumber ?? swap.blockNumber),
            amount: swap.amount || (existing?.amount ?? swap.amount),
            refundAddress:
                swap.refundAddress === zeroAddress
                    ? (existing?.refundAddress ?? swap.refundAddress)
                    : swap.refundAddress,
        });
    }

    return [...merged.values()];
};

const hasPreimageHash = (swap: RestorableSwap): swap is RestoredEvmSwap =>
    swap.preimageHash !== undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isRestorableEvmClaimDetails = (
    value: unknown,
): value is RestorableEvmClaimDetails => {
    if (!isRecord(value)) {
        return false;
    }

    if (
        typeof value.contractAddress !== "string" ||
        typeof value.claimAddress !== "string" ||
        typeof value.timeoutBlockHeight !== "number"
    ) {
        return false;
    }

    if (
        value.transaction !== undefined &&
        (!isRecord(value.transaction) ||
            typeof value.transaction.id !== "string")
    ) {
        return false;
    }

    if (value.amount !== undefined && typeof value.amount !== "number") {
        return false;
    }

    return value.keyIndex === undefined || typeof value.keyIndex === "number";
};

export const getRestoredEvmClaimDetails = (
    swap: RestorableSwap,
): RestorableEvmClaimDetails | undefined => {
    const evmClaimDetails = (swap as { evmClaimDetails?: unknown })
        .evmClaimDetails;
    if (isRestorableEvmClaimDetails(evmClaimDetails)) {
        return evmClaimDetails;
    }

    const claimDetails = (swap as { claimDetails?: unknown }).claimDetails;
    return isRestorableEvmClaimDetails(claimDetails) ? claimDetails : undefined;
};

export const getRestoredEvmClaimTransactionHash = (
    swap: RestorableSwap,
): string | undefined => getRestoredEvmClaimDetails(swap)?.transaction?.id;

const getRestorableDetailKeyIndex = (value: unknown): number | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    return typeof value.keyIndex === "number" ? value.keyIndex : undefined;
};

export const getRestoredEvmClaimKeyIndex = (
    swap: RestorableSwap,
): number | undefined =>
    getRestorableDetailKeyIndex(
        (swap as { evmClaimDetails?: unknown }).evmClaimDetails,
    ) ??
    getRestorableDetailKeyIndex(
        (swap as { claimDetails?: unknown }).claimDetails,
    );

export const getRestoredEvmClaimAsset = (swap: RestoredEvmSwap): string => {
    if (swap.dex?.position === SwapPosition.Post) {
        return swap.dex.hops[0]?.from ?? swap.to;
    }

    return swap.to;
};

export const getRestoredEvmClaimChainId = (
    swap: RestoredEvmSwap,
): number | undefined =>
    config.assets?.[getRestoredEvmClaimAsset(swap)]?.network?.chainId;

const prefixHex = (value: string): Hex =>
    (value.startsWith("0x") ? value : `0x${value}`) as Hex;

export const mapRestoredEvmClaimResult = (
    swap: RestoredEvmSwap,
    preimage: string,
): EvmRescueResult | undefined => {
    const details = getRestoredEvmClaimDetails(swap);
    const transactionHash = details?.transaction?.id;
    const asset = getRestoredEvmClaimAsset(swap);

    if (
        details === undefined ||
        transactionHash === undefined ||
        normalizeEvmId(swap.preimageHash) === "" ||
        config.assets?.[asset]?.network?.chainId === undefined
    ) {
        return undefined;
    }

    return {
        action: RskRescueMode.Claim,
        asset: asset as AssetType,
        blockNumber: 0,
        transactionHash: prefixHex(transactionHash),
        preimageHash: normalizeEvmId(swap.preimageHash) as Hex,
        preimage: normalizeEvmId(preimage) as Hex,
        amount: satsToAssetAmount(details.amount ?? 0, asset),
        claimAddress: getAddress(details.claimAddress),
        refundAddress: zeroAddress,
        timelock: BigInt(details.timeoutBlockHeight),
        restoredSwap: swap,
        dex: swap.dex,
        bridge: swap.bridge,
    };
};

export const mapRestoredEvmClaimResultFromRescueKey = (
    swap: RestoredEvmSwap,
    rescueFile: RescueFile,
): EvmRescueResult | undefined => {
    const keyIndex = getRestoredEvmClaimKeyIndex(swap);
    const asset = getRestoredEvmClaimAsset(swap);
    if (keyIndex === undefined) {
        return undefined;
    }

    const preimage = derivePreimageFromRescueKey(
        rescueFile,
        keyIndex,
        asset as AssetType,
    );
    const preimageHex = hex.encode(preimage);
    const expectedHash = normalizeEvmId(swap.preimageHash);
    if (
        expectedHash === "" ||
        normalizeEvmId(hex.encode(sha256(preimage))) !== expectedHash
    ) {
        return undefined;
    }

    return mapRestoredEvmClaimResult(swap, preimageHex);
};

const getRestoredEvmMatchDetails = (
    swap: EvmRescueResult,
    restoredSwaps: RestoredEvmSwap[],
): RestoredEvmMatch | undefined => {
    const txHash = normalizeEvmId(swap.transactionHash);

    for (const restored of restoredSwaps) {
        if (txHash !== "" && normalizeEvmId(restored.lockupTx) === txHash) {
            return {
                restoredSwap: restored,
                reason: "metadata-lockup-transaction",
            };
        }

        if (
            txHash !== "" &&
            normalizeEvmId(restored.commitmentLockupTxHash) === txHash
        ) {
            return {
                restoredSwap: restored,
                reason: "metadata-commitment-transaction",
            };
        }

        if (
            txHash !== "" &&
            normalizeEvmId(getRestoredEvmClaimTransactionHash(restored)) ===
                txHash
        ) {
            return {
                restoredSwap: restored,
                reason: "restore-claim-transaction",
            };
        }
    }

    return undefined;
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

        return {
            ...swap,
            restoredSwap: match.restoredSwap,
            dex: match.restoredSwap.dex,
            bridge: match.restoredSwap.bridge,
        };
    });

export const mapRestoredEvmSwaps = async (
    swaps: RestorableSwap[],
    mnemonic: string,
): Promise<RestoredEvmSwap[]> => {
    return await hydrateRestorableSwapsMetadata(
        swaps.filter(hasPreimageHash),
        mnemonic,
    ).then(filterHydratedEvmSwaps);
};

const getRestoredEvmSwapKey = (swap: RestoredEvmSwap) =>
    normalizeEvmId(swap.preimageHash) ||
    normalizeEvmId(swap.lockupTx) ||
    normalizeEvmId(swap.commitmentLockupTxHash) ||
    normalizeEvmId(getRestoredEvmClaimTransactionHash(swap)) ||
    swap.id;

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

export const getEvmRestoreChainIds = (): number[] =>
    Array.from(
        new Set(
            Object.values(config.assets ?? {})
                .map((asset) => asset.network?.chainId)
                .filter(
                    (chainId): chainId is number => typeof chainId === "number",
                )
                .filter(
                    (chainId) =>
                        chainId !== config.assets?.[RBTC]?.network?.chainId,
                ),
        ),
    );

export const getEvmRestoreAccounts = (
    rescueFile: RescueFile,
    chainIds = getEvmRestoreChainIds(),
) => {
    const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
    const seen = new Set<string>();

    return chainIds.flatMap((chainId) => {
        const account = evmAccountFromPrivateKey(
            hdKey.derive(getPathGasAbstraction(chainId)).privateKey,
        );
        const key = account.address.toLowerCase();
        if (seen.has(key)) {
            return [];
        }
        seen.add(key);
        return [{ chainId, account }];
    });
};

export const getEvmRestoreMessage = (address: string, timestamp: number) =>
    `Boltz swap restore\naddress: ${address}\ntimestamp: ${timestamp}`;

export const getRestorableSwapsByEvmAddress = async (
    account: ReturnType<typeof evmAccountFromPrivateKey>,
    signal: AbortSignal,
): Promise<RestorableSwap[]> => {
    const timestamp = Math.floor(Date.now() / 1_000);
    const address = getAddress(account.address);
    const signature = await account.signMessage({
        message: getEvmRestoreMessage(address, timestamp),
    });

    return await fetcher<RestorableSwap[]>(
        "/v2/swap/restore",
        {
            address,
            timestamp,
            signature,
        },
        { signal },
        30_000,
    );
};

export const fetchEvmAddressRestorableSwaps = async (
    rescueFile: RescueFile,
    signal: AbortSignal,
): Promise<RestorableSwap[]> => {
    const results = await Promise.allSettled(
        getEvmRestoreAccounts(rescueFile).map(async ({ account, chainId }) => ({
            chainId,
            address: account.address,
            swaps: await getRestorableSwapsByEvmAddress(account, signal),
        })),
    );

    const swaps: RestorableSwap[][] = [];
    for (const result of results) {
        if (result.status === "fulfilled") {
            swaps.push(result.value.swaps);
            continue;
        }

        if (!signal.aborted) {
            log.warn(
                "failed to restore swaps by EVM claim address:",
                formatError(result.reason),
            );
        }
    }

    return mergeRestorableSwaps(...swaps);
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
): RestoredEvmSwap[] =>
    swaps.filter(
        (swap): swap is RestoredEvmSwap =>
            hasPreimageHash(swap) &&
            (normalizeEvmId(swap.lockupTx) !== "" ||
                normalizeEvmId(swap.commitmentLockupTxHash) !== "" ||
                normalizeEvmId(getRestoredEvmClaimTransactionHash(swap)) !==
                    ""),
    );

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
    includeRbtc = true,
): EvmScanTarget[] => {
    const targets: EvmScanTarget[] = [];

    const rskEndpoint = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (rskEndpoint && includeRbtc) {
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
