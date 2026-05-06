import { useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import { createProvider } from "boltz-swaps/evm";
import log from "loglevel";
import { IoKey, IoWallet } from "solid-icons/io";
import {
    type Accessor,
    For,
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";
import type { Address } from "viem";

import ConnectWallet from "../components/ConnectWallet";
import LoadingSpinner from "../components/LoadingSpinner";
import Pagination, {
    desktopItemsPerPage,
    mobileItemsPerPage,
} from "../components/Pagination";
import RescueFileUpload, {
    type RescueFileError,
    type RescueFileResult,
} from "../components/RescueFileUpload";
import { SwapIcons } from "../components/SwapIcons";
import { type Swap, getSwapListHeight } from "../components/SwapList";
import { hiddenInformation } from "../components/settings/PrivacyMode";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { config } from "../config";
import {
    type AssetType,
    BTC,
    LBTC,
    RBTC,
    TBTC,
    USDC,
    USDT0,
    getAssetDisplaySymbol,
} from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { paginationLimit } from "../consts/Pagination";
import { type tFn, useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import "../style/asset.scss";
import "../style/rescueExternal.scss";
import { type RestorableSwap, getRestorableSwaps } from "../utils/boltzClient";
import { isEmptyPreimageHash } from "../utils/commitment";
import {
    type LogRefundData,
    type SwapContract,
    getTimelockBlockNumber,
    scanLockupEvents,
} from "../utils/contractLogs";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import {
    type GasAbstractionSweep,
    getGasAbstractionSweepDisplayAmount,
    getSweepableGasAbstractionBalances,
} from "../utils/gasAbstractionSweep";
import { cropString, isMobile } from "../utils/helper";
import {
    RescueAction,
    RescueNoAction,
    createRescueList,
} from "../utils/rescue";
import { evmAccountFromPrivateKey } from "../utils/rescueDerivation";
import {
    type RescueFile,
    getPathGasAbstraction,
    getXpub,
    mnemonicToHDKey,
} from "../utils/rescueFile";
import type { SomeSwap } from "../utils/swapCreator";
import ErrorWasm from "./ErrorWasm";
import { mapSwap } from "./RefundRescue";

type Method = "key" | "wallet";
type Action = "Refund" | "Claim";

type RecoveryOption = {
    asset: string;
    className: string;
    network?: string;
    actions: Action[];
    methods: Method[];
};

type EvmScanTarget = {
    asset: string;
    providerUrl: string;
    scanInterval?: number;
    contract: SwapContract;
};

type ScanProgress = {
    byAsset: Map<string, { progress: number; derivedKeys?: number }>;
    unmatchedByAsset: Map<string, number>;
    update: (asset: string, progress: number, derivedKeys?: number) => void;
    updateUnmatched: (asset: string, unmatched: number) => void;
};

type EvmRescueResult = LogRefundData & {
    action: RskRescueMode;
    currentHeight?: bigint;
};

type UnifiedRescueResult =
    | {
          source: "restore";
          key: string;
          action: RescueAction;
          actionable: boolean;
          sortValue: number;
          swap: Swap;
      }
    | {
          source: "evm";
          key: string;
          action: RescueAction;
          evmAction: RskRescueMode;
          actionable: boolean;
          sortValue: number;
          swap: EvmRescueResult;
      }
    | {
          source: "sweep";
          key: string;
          action: RescueAction.Refund;
          actionable: true;
          sortValue: number;
          swap: GasAbstractionSweep;
      };

const recoveryOptions: RecoveryOption[] = [
    {
        asset: BTC,
        className: "asset-BTC",
        actions: ["Refund", "Claim"],
        methods: ["key"],
    },
    {
        asset: LBTC,
        className: "asset-LBTC",
        actions: ["Refund", "Claim"],
        methods: ["key"],
    },
    {
        asset: TBTC,
        className: "asset-TBTC",
        network: "arbitrum",
        actions: ["Refund", "Claim"],
        methods: ["key", "wallet"],
    },
    {
        asset: USDT0,
        className: "asset-USDT",
        network: "arbitrum",
        actions: ["Refund", "Claim"],
        methods: ["key", "wallet"],
    },
    {
        asset: USDC,
        className: "asset-USDC",
        network: "arbitrum",
        actions: ["Refund", "Claim"],
        methods: ["key", "wallet"],
    },
    {
        asset: RBTC,
        className: "asset-RBTC",
        actions: ["Refund"],
        methods: ["wallet"],
    },
    {
        asset: RBTC,
        className: "asset-RBTC",
        actions: ["Claim"],
        methods: ["key", "wallet"],
    },
];

const rescueActionPriority: Record<RescueAction, number> = {
    [RescueAction.Claim]: 0,
    [RescueAction.Refund]: 0,
    [RescueAction.Pending]: 1,
    [RescueAction.Failed]: 2,
    [RescueAction.Successful]: 2,
};

const resultSourcePriority: Record<UnifiedRescueResult["source"], number> = {
    restore: 0,
    evm: 1,
    sweep: 2,
};

const getSwapDate = (swap: Swap) => {
    if ("date" in swap) {
        return swap.date;
    }

    return swap.createdAt * 1_000;
};

const getEvmRescueAction = (swap: EvmRescueResult) => {
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

const sortUnifiedResults = (results: UnifiedRescueResult[]) =>
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

const missingMethodsTitle = (
    methods: Method[],
    activeMethods: Method[],
    t: tFn,
) => {
    const missing = methods.filter((method) => !activeMethods.includes(method));

    if (missing.length === 0) {
        return undefined;
    }

    if (methods.includes("key") && methods.includes("wallet")) {
        return t("rescue_external_requires_rescue_key_wallet");
    }

    return methods[0] === "key"
        ? t("rescue_external_requires_rescue_key")
        : t("rescue_external_requires_wallet");
};

const RequirementIcon = (props: { method: Method; active: boolean }) => (
    <Switch>
        <Match when={props.method === "key"}>
            <IoKey
                class="rescue-external-requirement-icon"
                data-active={props.active ? "true" : "false"}
                aria-label="Rescue key required"
            />
        </Match>
        <Match when={props.method === "wallet"}>
            <IoWallet
                class="rescue-external-requirement-icon"
                data-active={props.active ? "true" : "false"}
                aria-label="Wallet required"
            />
        </Match>
    </Switch>
);

const AssetIcon = (props: RecoveryOption) => (
    <span class={`asset ${props.className}`} data-network={props.network}>
        <span class="icon" />
    </span>
);

const assetDisplayLabel = (option: RecoveryOption, t: tFn) => {
    const symbol = getAssetDisplaySymbol(option.asset);
    if (option.asset === RBTC && option.actions.length === 1) {
        const action =
            option.actions[0] === "Refund"
                ? t("refund")
                : t("rescue_external_resume");
        return `${symbol} (${action})`;
    }
    return symbol;
};

const RecoveryChip = (
    props: RecoveryOption & {
        active: boolean;
        activeMethods: Method[];
        tooltip?: string;
        t: tFn;
    },
) => (
    <div
        class="rescue-external-chip"
        data-active={props.active ? "true" : "false"}
        data-size={props.asset === RBTC ? "lg" : "sm"}
        data-tooltip={props.tooltip}>
        <AssetIcon {...props} />
        <strong>{assetDisplayLabel(props, props.t)}</strong>
        <span class="rescue-external-chip-requirements">
            <For each={props.methods}>
                {(method) => (
                    <RequirementIcon
                        method={method}
                        active={props.activeMethods.includes(method)}
                    />
                )}
            </For>
        </span>
    </div>
);

const EvmAssetIcon = (props: { asset: AssetType }) => (
    <span class="swaplist-asset swaplist-asset-single">
        <span data-asset={getAssetDisplaySymbol(props.asset)} />
    </span>
);

const fetchPaginatedRestorableSwaps = async (
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

const mapRestorableSwapList = (swaps: RestorableSwap[]) =>
    swaps
        .map((swap) => mapSwap(swap))
        .filter((swap): swap is Partial<SomeSwap> => swap !== undefined);

const getEvmScanTargets = (
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
        config.assets?.[TBTC]?.contracts?.deployHeight &&
        config.network !== "regtest"
    ) {
        targets.push({
            asset: TBTC,
            providerUrl: arbEndpoint,
            scanInterval: 100_000,
            contract: getErc20Swap(TBTC),
        });
    } else if (!arbEndpoint) {
        log.warn("arbitrum log endpoint not set");
    }

    return targets;
};

const RescueExternal = () => {
    const { t, wasmSupported, denomination, separator, privacyMode } =
        useGlobalContext();
    const navigate = useNavigate();
    const { signer, getEtherSwap, getErc20Swap, getGasAbstractionSigner } =
        useWeb3Signer();
    const {
        setEvmRescuableSwaps,
        setRescuableSwaps,
        setRescueFile: setContextRescueFile,
    } = useRescueContext();

    const evmAvailable =
        !!import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT ||
        (!!import.meta.env.VITE_ARBITRUM_LOG_SCAN_ENDPOINT &&
            config.assets?.[TBTC]?.contracts?.deployHeight !== undefined);

    if (!evmAvailable) {
        log.warn("No EVM log scan endpoints available");
    }

    const [rescueFile, setRescueFile] = createSignal<RescueFile>();
    const [rescueFileName, setRescueFileName] = createSignal<string>();
    const [refundInvalid, setRefundInvalid] = createSignal<
        RescueFileError | undefined
    >(undefined);
    const [sweepableBalances, setSweepableBalances] = createSignal<
        GasAbstractionSweep[]
    >([]);

    const [hasSearched, setHasSearched] = createSignal(false);
    const [isSearching, setIsSearching] = createSignal(false);
    const [searchError, setSearchError] = createSignal<string | undefined>();

    const [loadedBtcSwaps, setLoadedBtcSwaps] = createSignal(0);
    const [btcSearchState, setBtcSearchState] = createSignal<
        "idle" | "loading" | "ready" | "errored"
    >("idle");
    const [btcSearchError, setBtcSearchError] = createSignal<
        string | undefined
    >();
    const [btcSwaps, setBtcSwaps] = createSignal<Partial<SomeSwap>[]>([]);
    const [currentResultPage, setCurrentResultPage] = createSignal(1);
    const [currentResults, setCurrentResults] = createSignal<
        UnifiedRescueResult[]
    >([]);
    const [btcListLoading, setBtcListLoading] = createSignal(false);

    const [evmRefundSwaps, setEvmRefundSwaps] = createSignal<EvmRescueResult[]>(
        [],
    );
    const [evmClaimSwaps, setEvmClaimSwaps] = createSignal<EvmRescueResult[]>(
        [],
    );
    const [evmRefundProgress, setEvmRefundProgress] = createSignal<
        string | undefined
    >();
    const [evmClaimProgress, setEvmClaimProgress] = createSignal<
        string | undefined
    >();
    const [unmatchedRefundSwaps, setUnmatchedRefundSwaps] = createSignal(0);
    const [unmatchedClaimSwaps, setUnmatchedClaimSwaps] = createSignal(0);

    let scanAbort: AbortController | undefined = undefined;

    const [btcRescueList] = createResource(btcSwaps, async (swaps) => {
        setBtcListLoading(true);
        return await createRescueList(swaps as SomeSwap[], true).finally(() =>
            setBtcListLoading(false),
        );
    });

    createEffect(() => {
        setEvmRescuableSwaps([...evmRefundSwaps(), ...evmClaimSwaps()]);
    });

    const activeMethods = createMemo<Method[]>(() => {
        const methods: Method[] = [];
        if (rescueFile() !== undefined) {
            methods.push("key");
        }
        if (signer() !== undefined) {
            methods.push("wallet");
        }
        return methods;
    });

    const canSearch = () => activeMethods().length > 0;
    const showResultsPage = () => hasSearched() || isSearching();

    const canRecover = (option: RecoveryOption) =>
        option.methods.every((method) => activeMethods().includes(method));

    const searchText = () => {
        if (isSearching()) {
            return t("stop_scanning");
        }
        if (!canSearch()) {
            return t("rescue_external_select_method");
        }
        return t("rescue");
    };

    const hasBtcResults = () => btcSwaps().length > 0;
    const hasEvmRefundResults = () => evmRefundSwaps().length > 0;
    const hasEvmClaimResults = () => evmClaimSwaps().length > 0;
    const hasSweepableBalances = () => sweepableBalances().length > 0;
    const hasAnyResults = () =>
        hasBtcResults() ||
        hasEvmRefundResults() ||
        hasEvmClaimResults() ||
        hasSweepableBalances();
    const currentEvmProgress = createMemo(
        () => evmClaimProgress() ?? evmRefundProgress(),
    );
    const unifiedResults = createMemo(() => {
        const btcResults: UnifiedRescueResult[] = (btcRescueList() ?? []).map(
            (swap) => {
                const action = swap.action ?? RescueAction.Pending;
                return {
                    source: "restore",
                    key: `restore:${swap.id}`,
                    action,
                    actionable: !RescueNoAction.includes(action),
                    sortValue: getSwapDate(swap),
                    swap,
                };
            },
        );
        const evmResults: UnifiedRescueResult[] = [
            ...evmRefundSwaps(),
            ...evmClaimSwaps(),
        ].map((swap) => {
            const action = getEvmRescueAction(swap);
            return {
                source: "evm",
                key: `evm:${swap.action}:${swap.asset}:${swap.transactionHash}`,
                action,
                evmAction: swap.action,
                actionable: !RescueNoAction.includes(action),
                sortValue: swap.blockNumber,
                swap,
            };
        });
        const sweepResults: UnifiedRescueResult[] = sweepableBalances().map(
            (swap) => ({
                source: "sweep",
                key: `sweep:${swap.asset}:${swap.signer.address}`,
                action: RescueAction.Refund,
                actionable: true,
                sortValue: 0,
                swap,
            }),
        );

        return sortUnifiedResults([
            ...btcResults,
            ...evmResults,
            ...sweepResults,
        ]);
    });

    const resetSearchResults = () => {
        setHasSearched(false);
        setSearchError(undefined);
        setLoadedBtcSwaps(0);
        setBtcSearchState("idle");
        setBtcSearchError(undefined);
        setBtcSwaps([]);
        setCurrentResults([]);
        setCurrentResultPage(1);
        setEvmRefundSwaps([]);
        setEvmClaimSwaps([]);
        setEvmRefundProgress(undefined);
        setEvmClaimProgress(undefined);
        setUnmatchedRefundSwaps(0);
        setUnmatchedClaimSwaps(0);
        setSweepableBalances([]);
        setRescuableSwaps([]);
    };

    const stopSearch = () => {
        if (scanAbort) {
            scanAbort.abort("scan stopped");
            scanAbort = undefined;
        }
        if (btcSearchState() === "loading") {
            setBtcSearchState("idle");
        }
        if (!hasAnyResults()) {
            setHasSearched(false);
        }
        setIsSearching(false);
        setEvmRefundProgress(undefined);
        setEvmClaimProgress(undefined);
    };

    const backToMethodSelection = () => {
        stopSearch();
        resetSearchResults();
    };

    const handleFileValidated = (result: RescueFileResult) => {
        resetSearchResults();
        setRefundInvalid(undefined);

        setRescueFile(result.data);
        setRescueFileName(result.fileName ?? t("rescue_key"));
        setContextRescueFile(result.data);
    };

    const handleFileError = (error: RescueFileError) => {
        resetSearchResults();
        setRefundInvalid(error);
        setRescueFile(undefined);
        setRescueFileName(undefined);
    };

    const handleReset = () => {
        stopSearch();
        resetSearchResults();
        setRefundInvalid(undefined);
        setRescueFile(undefined);
        setRescueFileName(undefined);
    };

    const createScanProgress = (
        setProgress: (progress: string | undefined) => void,
        setUnmatched: (count: number) => void,
    ): ScanProgress => {
        const byAsset = new Map<
            string,
            { progress: number; derivedKeys?: number }
        >();
        const unmatchedByAsset = new Map<string, number>();

        const update = (
            asset: string,
            progress: number,
            derivedKeys?: number,
        ) => {
            byAsset.set(asset, { progress, derivedKeys });

            let totalProgress = 0;
            let totalDeriving = 0;
            let anyDeriving = false;

            for (const v of byAsset.values()) {
                totalProgress += v.progress;
                if (v.progress >= 1 && v.derivedKeys !== undefined) {
                    totalDeriving += v.derivedKeys;
                    anyDeriving = true;
                }
            }

            const combined = totalProgress / byAsset.size;

            if (combined >= 1 && anyDeriving) {
                setProgress(t("logs_deriving_keys", { count: totalDeriving }));
            } else {
                setProgress(
                    t("logs_scan_progress", {
                        value: (combined * 100).toFixed(2),
                    }),
                );
            }
        };

        const updateUnmatched = (asset: string, unmatched: number) => {
            unmatchedByAsset.set(asset, unmatched);
            let total = 0;
            for (const v of unmatchedByAsset.values()) {
                total += v;
            }
            setUnmatched(total);
        };

        return { byAsset, unmatchedByAsset, update, updateUnmatched };
    };

    const runBtcRestore = async (
        currentRescueFile: RescueFile,
        signal: AbortSignal,
    ) => {
        setBtcSearchState("loading");
        setBtcSearchError(undefined);

        try {
            const restorableSwaps = await fetchPaginatedRestorableSwaps(
                currentRescueFile,
                setLoadedBtcSwaps,
                signal,
            );
            if (signal.aborted) {
                return;
            }
            setRescuableSwaps(restorableSwaps);
            setBtcSwaps(mapRestorableSwapList(restorableSwaps));
            setBtcSearchState("ready");
        } catch (e) {
            if (signal.aborted) {
                return;
            }
            const error = formatError(e);
            setBtcSearchError(error);
            setBtcSearchState("errored");
            throw e;
        }
    };

    const runSingleScan = async (
        target: EvmScanTarget,
        signerAddress: Address,
        action: RskRescueMode,
        scanProgress: ScanProgress,
        signal: AbortSignal,
        onEvents: (events: EvmRescueResult[]) => void,
        mnemonic?: string,
    ) => {
        const extraAddresses: string[] = [];
        if (mnemonic) {
            const chainId = config.assets?.[target.asset]?.network?.chainId;
            if (chainId !== undefined) {
                const gasKey = mnemonicToHDKey(mnemonic).derive(
                    getPathGasAbstraction(chainId),
                );
                extraAddresses.push(
                    evmAccountFromPrivateKey(gasKey.privateKey).address,
                );
            }
        }

        let currentHeight: bigint | undefined;
        if (action === RskRescueMode.Refund) {
            try {
                currentHeight = BigInt(
                    await getTimelockBlockNumber(
                        createProvider([target.providerUrl]),
                        target.asset as AssetType,
                    ),
                );
            } catch (e) {
                log.warn(
                    `failed to fetch current timelock height for ${target.asset}:`,
                    formatError(e),
                );
            }
        }

        const generator = scanLockupEvents(signal, target.contract, {
            asset: target.asset as AssetType,
            providerUrl: target.providerUrl,
            scanInterval: target.scanInterval,
            filter: {
                address: signerAddress,
                extraAddresses:
                    extraAddresses.length > 0 ? extraAddresses : undefined,
            },
            action,
            mnemonic,
        });

        for await (const {
            events,
            progress,
            derivedKeys,
            unmatchedSwaps,
        } of generator) {
            if (signal.aborted) {
                break;
            }

            scanProgress.update(target.asset, progress, derivedKeys);

            if (events.length > 0) {
                onEvents(
                    events.map((event) => ({
                        ...event,
                        action,
                        currentHeight,
                    })),
                );
            }
            scanProgress.updateUnmatched(target.asset, unmatchedSwaps);
        }
    };

    const runEvmScan = async (
        action: RskRescueMode,
        signerAddress: Address,
        signal: AbortSignal,
        currentRescueFile?: RescueFile,
    ) => {
        const targets = getEvmScanTargets(
            getEtherSwap as (a: string) => SwapContract,
            getErc20Swap as (a: string) => SwapContract,
            action,
            currentRescueFile !== undefined,
        );

        if (targets.length === 0) {
            return;
        }

        const setProgress =
            action === RskRescueMode.Refund
                ? setEvmRefundProgress
                : setEvmClaimProgress;
        const setUnmatched =
            action === RskRescueMode.Refund
                ? setUnmatchedRefundSwaps
                : setUnmatchedClaimSwaps;
        const setSwaps =
            action === RskRescueMode.Refund
                ? setEvmRefundSwaps
                : setEvmClaimSwaps;

        setProgress(
            t("logs_scan_progress", {
                value: Number(0).toFixed(2),
            }),
        );

        const scanProgress = createScanProgress(setProgress, setUnmatched);

        const sweepBalances =
            action === RskRescueMode.Refund && currentRescueFile !== undefined
                ? getSweepableGasAbstractionBalances({
                      destination: signerAddress,
                      rescueFile: currentRescueFile,
                      getGasAbstractionSigner,
                  }).then((balances) => {
                      if (!signal.aborted) {
                          setSweepableBalances(balances);
                      }
                  })
                : Promise.resolve();

        try {
            await Promise.all([
                ...targets.map((target) =>
                    runSingleScan(
                        target,
                        signerAddress,
                        action,
                        scanProgress,
                        signal,
                        (events) =>
                            setSwaps((current) => current.concat(events)),
                        currentRescueFile?.mnemonic,
                    ),
                ),
                sweepBalances,
            ]);
        } finally {
            if (!signal.aborted) {
                setProgress(undefined);
            }
        }
    };

    const startSearch = async () => {
        if (isSearching()) {
            stopSearch();
            return;
        }

        if (!canSearch()) {
            return;
        }

        const currentRescueFile = rescueFile();
        const currentSigner = signer();

        stopSearch();
        resetSearchResults();
        setHasSearched(true);
        setIsSearching(true);

        scanAbort = new AbortController();
        const signal = scanAbort.signal;

        try {
            const tasks: Promise<void>[] = [];
            if (currentRescueFile) {
                tasks.push(runBtcRestore(currentRescueFile, signal));
            }

            if (currentSigner && evmAvailable) {
                const signerAddress = currentSigner.address;

                if (signal.aborted) {
                    return;
                }

                tasks.push(
                    runEvmScan(
                        RskRescueMode.Refund,
                        signerAddress,
                        signal,
                        currentRescueFile,
                    ),
                );

                if (currentRescueFile) {
                    tasks.push(
                        runEvmScan(
                            RskRescueMode.Claim,
                            signerAddress,
                            signal,
                            currentRescueFile,
                        ),
                    );
                }
            }

            const results = await Promise.allSettled(tasks);
            const errors = results
                .filter(
                    (result): result is PromiseRejectedResult =>
                        result.status === "rejected",
                )
                .map((result) => formatError(result.reason));

            if (errors.length > 0 && !signal.aborted) {
                setSearchError(errors.join("\n"));
            }
        } catch (e) {
            if (!signal.aborted) {
                setSearchError(formatError(e));
            }
        } finally {
            if (!signal.aborted) {
                setIsSearching(false);
                scanAbort = undefined;
            }
        }
    };

    onCleanup(() => {
        stopSearch();
    });

    const resultActionLabel = (action: RescueAction) => {
        switch (action) {
            case RescueAction.Pending:
                return t("in_progress");
            case RescueAction.Claim:
                return t("claim");
            case RescueAction.Refund:
                return t("refund");
            case RescueAction.Failed:
                return t("failed");
            case RescueAction.Successful:
            default:
                return t("completed");
        }
    };

    const getSweepAmount = (sweep: GasAbstractionSweep) =>
        formatAmount(
            new BigNumber(
                getGasAbstractionSweepDisplayAmount(sweep).toString(),
            ),
            denomination(),
            separator(),
            sweep.asset,
        );

    const resultDetailLabel = (result: UnifiedRescueResult) => {
        if (result.source === "evm") {
            return t("block");
        }

        return result.source === "sweep" ? t("balance") : t("created");
    };

    const formatResultDetail = (result: UnifiedRescueResult) => {
        if (result.source === "evm") {
            return `${t("block")} ${result.swap.blockNumber}`;
        }

        if (result.source === "sweep") {
            return `${getSweepAmount(result.swap)} ${formatDenomination(
                denomination(),
                result.swap.asset,
            )}`;
        }

        const date = new Date();
        date.setTime(getSwapDate(result.swap));
        return date.toLocaleDateString();
    };

    const openResult = (result: UnifiedRescueResult) => {
        if (!result.actionable) {
            return;
        }

        if (result.source === "evm") {
            navigate(
                `/swap/rescue/evm/${result.swap.asset}/${result.swap.transactionHash}/${result.evmAction}`,
            );
            return;
        }

        if (result.source === "sweep") {
            navigate(
                `/swap/rescue/evm/gas-abstraction/${result.swap.asset}/${result.swap.signer.address}/${RskRescueMode.Refund}`,
            );
            return;
        }

        if (result.action === RescueAction.Claim) {
            navigate(`/rescue/claim/${result.swap.id}`);
            return;
        }

        navigate(`/rescue/refund/${result.swap.id}`, {
            state: {
                waitForSwapTimeout: result.swap.waitForSwapTimeout,
            },
        });
    };

    const resultId = (result: UnifiedRescueResult) => {
        switch (result.source) {
            case "evm":
                return cropString(result.swap.transactionHash, 15, 5);
            case "sweep":
                return cropString(result.swap.signer.address, 15, 5);
            case "restore":
                return result.swap.id;
        }
    };

    const resultTestId = (result: UnifiedRescueResult) =>
        result.source === "restore"
            ? `swaplist-item-${result.swap.id}`
            : `swaplist-item-${result.key}`;

    const UnifiedResultAssets = (props: { result: UnifiedRescueResult }) => (
        <Switch>
            <Match when={props.result.source === "restore"}>
                <SwapIcons
                    swap={
                        (
                            props.result as Extract<
                                UnifiedRescueResult,
                                { source: "restore" }
                            >
                        ).swap
                    }
                />
            </Match>
            <Match when={props.result.source === "evm"}>
                <EvmAssetIcon
                    asset={
                        (
                            props.result as Extract<
                                UnifiedRescueResult,
                                { source: "evm" }
                            >
                        ).swap.asset
                    }
                />
            </Match>
            <Match when={props.result.source === "sweep"}>
                <EvmAssetIcon
                    asset={
                        (
                            props.result as Extract<
                                UnifiedRescueResult,
                                { source: "sweep" }
                            >
                        ).swap.asset
                    }
                />
            </Match>
        </Switch>
    );

    const UnifiedRescueList = (props: {
        results: Accessor<UnifiedRescueResult[]>;
    }) => (
        <div id="swaplist" class="rescue-external-result-list">
            <hr />
            <For each={props.results()}>
                {(result, index) => (
                    <>
                        <div
                            data-testid={resultTestId(result)}
                            class={`swaplist-item ${
                                !result.actionable ? "disabled" : ""
                            }`}
                            onClick={() => openResult(result)}>
                            <a
                                class="btn-small"
                                href="#"
                                onClick={(e) => e.preventDefault()}>
                                {resultActionLabel(result.action)}
                            </a>
                            <UnifiedResultAssets result={result} />
                            <span class="swaplist-asset-id">
                                {t("id")}:&nbsp;
                                <Show
                                    when={!privacyMode()}
                                    fallback={hiddenInformation}>
                                    <span class="monospace">
                                        {resultId(result)}
                                    </span>
                                </Show>
                            </span>
                            <span class="swaplist-asset-date hidden-mobile">
                                {resultDetailLabel(result)}:&nbsp;
                                <span class="monospace">
                                    {formatResultDetail(result)}
                                </span>
                            </span>
                        </div>
                        <Show when={index() < props.results().length - 1}>
                            <hr />
                        </Show>
                    </>
                )}
            </For>
            <hr />
        </div>
    );

    const Results = () => (
        <>
            <Show when={btcSearchState() === "loading"}>
                <p class="restore-loading-progress">
                    {t("swaps_found", { count: loadedBtcSwaps() })}
                </p>
                <LoadingSpinner class="restore-loading-spinner" />
            </Show>
            <Show when={btcSearchState() === "errored"}>
                <h3 class="frame-text-spaced">
                    {t("error")}: {btcSearchError()}
                </h3>
            </Show>

            <Show when={currentEvmProgress()}>
                <p class="frame-text">{currentEvmProgress()}</p>
            </Show>

            <Show when={btcListLoading() && unifiedResults().length === 0}>
                <LoadingSpinner />
            </Show>

            <Show when={unifiedResults().length > 0}>
                <div class="rescue-external-results">
                    <div
                        style={getSwapListHeight(
                            unifiedResults() as never as SomeSwap[],
                            isMobile(),
                        )}>
                        <UnifiedRescueList results={currentResults} />
                    </div>
                    <Pagination
                        items={unifiedResults}
                        setDisplayedItems={setCurrentResults}
                        totalItems={unifiedResults().length}
                        itemsPerPage={
                            isMobile()
                                ? mobileItemsPerPage
                                : desktopItemsPerPage
                        }
                        currentPage={currentResultPage}
                        setCurrentPage={setCurrentResultPage}
                    />
                </div>
            </Show>

            <Show when={unmatchedRefundSwaps() > 0}>
                <p class="frame-text">
                    {t("unmatched_swaps", { count: unmatchedRefundSwaps() })}
                </p>
            </Show>
            <Show when={unmatchedClaimSwaps() > 0}>
                <p class="frame-text">
                    {t("unmatched_swaps", { count: unmatchedClaimSwaps() })}
                </p>
            </Show>
            <Show when={searchError()}>
                <h3 class="frame-text-spaced">
                    {t("error")}: {searchError()}
                </h3>
            </Show>
            <Show when={hasSearched() && !isSearching() && !hasAnyResults()}>
                <h3>{t("no_swaps_found")}</h3>
            </Show>
        </>
    );

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund" class="rescue-external">
                <div
                    class="frame rescue-external-frame"
                    data-testid="refundFrame">
                    <header>
                        <SettingsCog />
                        <h2 class="frame-title">{t("rescue_external_swap")}</h2>
                    </header>

                    <Show
                        when={!showResultsPage()}
                        fallback={
                            <>
                                <Results />
                                <div class="btns rescue-external-actions">
                                    <button
                                        class="btn"
                                        type="button"
                                        onClick={backToMethodSelection}>
                                        {t("back")}
                                    </button>
                                </div>
                            </>
                        }>
                        <p class="frame-text rescue-external-subtitle">
                            {t("rescue_external_subtitle")}
                        </p>

                        <hr />
                        <RescueFileUpload
                            onFileValidated={handleFileValidated}
                            onError={handleFileError}
                            onReset={handleReset}
                            autoSubmitMnemonic
                            mnemonicBackLabel={t("upload_rescue_key")}
                            fileName={rescueFileName()}
                            error={
                                refundInvalid() !== undefined
                                    ? t("invalid_refund_file")
                                    : undefined
                            }
                        />
                        <hr />
                        <div
                            class="rescue-external-wallet-slot"
                            data-connected={
                                activeMethods().includes("wallet")
                                    ? "true"
                                    : "false"
                            }>
                            <ConnectWallet />
                        </div>
                        <hr />

                        <div
                            class="rescue-external-coverage"
                            data-empty={!canSearch() ? "true" : "false"}>
                            <p>{t("rescue_external_coverage")}</p>
                            <div class="rescue-external-chip-list">
                                <For each={recoveryOptions}>
                                    {(option) => (
                                        <RecoveryChip
                                            {...option}
                                            active={canRecover(option)}
                                            activeMethods={activeMethods()}
                                            t={t}
                                            tooltip={missingMethodsTitle(
                                                option.methods,
                                                activeMethods(),
                                                t,
                                            )}
                                        />
                                    )}
                                </For>
                            </div>
                        </div>

                        <div class="btns rescue-external-actions">
                            <button
                                class="btn"
                                type="button"
                                disabled={!canSearch()}
                                onClick={() => void startSearch()}>
                                {searchText()}
                            </button>
                        </div>
                    </Show>

                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default RescueExternal;
