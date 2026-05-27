import { useNavigate } from "@solidjs/router";
import {
    type SwapContract,
    createProvider,
    getTimelockBlockNumber,
    scanLockupEvents,
} from "boltz-swaps/evm";
import { type LogRefundData, RskRescueMode } from "boltz-swaps/types";
import log from "loglevel";
import {
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";
import { createStore } from "solid-js/store";
import type { Address } from "viem";

import type {
    RescueFileError,
    RescueFileResult,
} from "../../components/RescueFileUpload";
import { config } from "../../config";
import type { AssetType } from "../../consts/Assets";
import { useGlobalContext } from "../../context/Global";
import { useRescueContext } from "../../context/Rescue";
import { useWeb3Signer } from "../../context/Web3";
import type { DictKey } from "../../i18n/i18n";
import { formatError } from "../../utils/errors";
import {
    type GasAbstractionSweep,
    getSweepableGasAbstractionBalances,
} from "../../utils/gasAbstractionSweep";
import {
    RescueAction,
    RescueNoAction,
    createRescueList,
    enrichSwapsWithTempWalletData,
} from "../../utils/rescue";
import {
    evmAccountFromPrivateKey,
    mnemonicToHDKey,
} from "../../utils/rescueDerivation";
import { type RescueFile, getPathGasAbstraction } from "../../utils/rescueFile";
import type { SomeSwap } from "../../utils/swapCreator";
import { PreimageHashesWorker } from "../../workers/preimageHashes/PreimageHashesWorker";
import {
    arbitrumRescueAssets,
    fetchPaginatedRestorableSwaps,
    getEvmRescueAction,
    getEvmScanTargets,
    getSwapDate,
    mapRestorableSwapList,
    sortUnifiedResults,
} from "./scan";
import {
    BtcSearchState,
    type EvmRescueResult,
    type EvmScanTarget,
    RecoveryMethod,
    type RecoveryOption,
    RescueResultSource,
    type ScanProgress,
    type UnifiedRescueResult,
} from "./types";

type FileState = {
    rescueFile?: RescueFile;
    rescueFileName?: string;
    rescueFileNameKey?: DictKey;
    refundInvalid?: RescueFileError;
};

type SearchState = {
    hasSearched: boolean;
    isSearching: boolean;
    error?: string;
};

type BtcState = {
    loadedSwaps: number;
    searchState: BtcSearchState;
    error?: string;
    swaps: Partial<SomeSwap>[];
    listLoading: boolean;
};

type EvmState = {
    refundSwaps: EvmRescueResult[];
    claimSwaps: EvmRescueResult[];
    refundProgress?: string;
    claimProgress?: string;
    unmatchedRefundSwaps: number;
    unmatchedClaimSwaps: number;
    sweepableBalances: GasAbstractionSweep[];
};

type ExternalRescueState = {
    file: FileState;
    search: SearchState;
    btc: BtcState;
    evm: EvmState;
};

const initialExternalRescueState = (): ExternalRescueState => ({
    file: {},
    search: {
        hasSearched: false,
        isSearching: false,
    },
    btc: {
        loadedSwaps: 0,
        searchState: BtcSearchState.Idle,
        swaps: [],
        listLoading: false,
    },
    evm: {
        refundSwaps: [],
        claimSwaps: [],
        unmatchedRefundSwaps: 0,
        unmatchedClaimSwaps: 0,
        sweepableBalances: [],
    },
});

export const useExternalRescueSearch = () => {
    const { t } = useGlobalContext();
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
            arbitrumRescueAssets.some(
                (asset) =>
                    config.assets?.[asset]?.contracts?.deployHeight !==
                    undefined,
            ));

    if (!evmAvailable) {
        log.warn("No EVM log scan endpoints available");
    }

    const [state, setState] = createStore<ExternalRescueState>(
        initialExternalRescueState(),
    );
    const setFileState = (file: FileState) => {
        setState((current) => ({ ...current, file }));
    };
    const setSearchState = (search: Partial<SearchState>) => {
        setState((current) => ({
            ...current,
            search: { ...current.search, ...search },
        }));
    };
    const setBtcState = (btc: Partial<BtcState>) => {
        setState((current) => ({
            ...current,
            btc: { ...current.btc, ...btc },
        }));
    };
    const setEvmState = (evm: Partial<EvmState>) => {
        setState((current) => ({
            ...current,
            evm: { ...current.evm, ...evm },
        }));
    };
    const setEvmProgress = (
        action: RskRescueMode,
        progress: string | undefined,
    ) => {
        setEvmState(
            action === RskRescueMode.Refund
                ? { refundProgress: progress }
                : { claimProgress: progress },
        );
    };
    const setEvmUnmatchedSwaps = (action: RskRescueMode, count: number) => {
        setEvmState(
            action === RskRescueMode.Refund
                ? { unmatchedRefundSwaps: count }
                : { unmatchedClaimSwaps: count },
        );
    };
    const appendEvmSwaps = (
        action: RskRescueMode,
        events: EvmRescueResult[],
    ) => {
        setState((current) => ({
            ...current,
            evm:
                action === RskRescueMode.Refund
                    ? {
                          ...current.evm,
                          refundSwaps: current.evm.refundSwaps.concat(events),
                      }
                    : {
                          ...current.evm,
                          claimSwaps: current.evm.claimSwaps.concat(events),
                      },
        }));
    };
    const [currentResultPage, setCurrentResultPage] = createSignal(1);
    const [currentResults, setCurrentResults] = createSignal<
        UnifiedRescueResult[]
    >([]);

    let scanAbort: AbortController | undefined = undefined;

    const [btcRescueList] = createResource(
        () => state.btc.swaps,
        async (swaps) => {
            setBtcState({ listLoading: true });
            return await createRescueList(swaps as SomeSwap[], true).finally(
                () => setBtcState({ listLoading: false }),
            );
        },
    );

    createEffect(() => {
        setEvmRescuableSwaps([
            ...state.evm.refundSwaps,
            ...state.evm.claimSwaps,
        ]);
    });

    const activeMethods = createMemo<RecoveryMethod[]>(() => {
        const methods: RecoveryMethod[] = [];
        if (state.file.rescueFile !== undefined) {
            methods.push(RecoveryMethod.Key);
        }
        if (signer() !== undefined) {
            methods.push(RecoveryMethod.Wallet);
        }
        return methods;
    });

    const canSearch = () => activeMethods().length > 0;
    const showResultsPage = () =>
        state.search.hasSearched || state.search.isSearching;

    const canRecover = (option: RecoveryOption) =>
        option.methods.every((method) => activeMethods().includes(method));

    const searchText = () => {
        if (state.search.isSearching) {
            return t("stop_scanning");
        }
        if (!canSearch()) {
            return t("rescue_external_select_method");
        }
        return t("rescue");
    };

    const rescueFileDisplayName = () =>
        state.file.rescueFileName ??
        (state.file.rescueFileNameKey !== undefined
            ? t(state.file.rescueFileNameKey)
            : undefined);

    const fileErrorKey = (): DictKey | undefined =>
        state.file.refundInvalid !== undefined
            ? "invalid_refund_file"
            : undefined;

    const hasBtcResults = () => state.btc.swaps.length > 0;
    const hasEvmRefundResults = () => state.evm.refundSwaps.length > 0;
    const hasEvmClaimResults = () => state.evm.claimSwaps.length > 0;
    const hasSweepableBalances = () => state.evm.sweepableBalances.length > 0;
    const hasAnyResults = () =>
        hasBtcResults() ||
        hasEvmRefundResults() ||
        hasEvmClaimResults() ||
        hasSweepableBalances();

    const currentEvmProgress = createMemo(
        () => state.evm.claimProgress ?? state.evm.refundProgress,
    );

    const unifiedResults = createMemo(() => {
        const btcResults: UnifiedRescueResult[] = (btcRescueList() ?? []).map(
            (swap) => {
                const action = swap.action ?? RescueAction.Pending;
                return {
                    source: RescueResultSource.Restore,
                    key: `restore:${swap.id}`,
                    action,
                    actionable: !RescueNoAction.includes(action),
                    sortValue: getSwapDate(swap),
                    swap,
                };
            },
        );
        const evmResults: UnifiedRescueResult[] = [
            ...state.evm.refundSwaps,
            ...state.evm.claimSwaps,
        ].map((swap) => {
            const action = getEvmRescueAction(swap);
            return {
                source: RescueResultSource.Evm,
                key: `evm:${swap.action}:${swap.asset}:${swap.transactionHash}`,
                action,
                evmAction: swap.action,
                actionable: !RescueNoAction.includes(action),
                sortValue: swap.blockNumber,
                swap,
            };
        });
        const sweepResults: UnifiedRescueResult[] =
            state.evm.sweepableBalances.map((swap) => ({
                source: RescueResultSource.Sweep,
                key: `sweep:${swap.asset}:${swap.signer.address}`,
                action: RescueAction.Refund,
                actionable: true,
                sortValue: 0,
                swap,
            }));

        return sortUnifiedResults([
            ...btcResults,
            ...evmResults,
            ...sweepResults,
        ]);
    });

    const resetSearchResults = () => {
        setSearchState({ hasSearched: false, error: undefined });
        setBtcState({
            loadedSwaps: 0,
            searchState: BtcSearchState.Idle,
            error: undefined,
            swaps: [],
        });
        setCurrentResults([]);
        setCurrentResultPage(1);
        setEvmState({
            refundSwaps: [],
            claimSwaps: [],
            refundProgress: undefined,
            claimProgress: undefined,
            unmatchedRefundSwaps: 0,
            unmatchedClaimSwaps: 0,
            sweepableBalances: [],
        });
        setRescuableSwaps([]);
    };

    const stopSearch = () => {
        if (scanAbort) {
            scanAbort.abort("scan stopped");
            scanAbort = undefined;
        }
        if (state.btc.searchState === BtcSearchState.Loading) {
            setBtcState({ searchState: BtcSearchState.Idle });
        }
        if (!hasAnyResults()) {
            setSearchState({ hasSearched: false });
        }
        setSearchState({ isSearching: false });
        setEvmState({
            refundProgress: undefined,
            claimProgress: undefined,
        });
    };

    const backToMethodSelection = () => {
        stopSearch();
        resetSearchResults();
    };

    const handleFileValidated = (result: RescueFileResult) => {
        resetSearchResults();
        setFileState({
            refundInvalid: undefined,
            rescueFile: result.data,
            rescueFileName: result.fileName,
            rescueFileNameKey: result.fileNameKey,
        });
        setContextRescueFile(result.data);
    };

    const handleFileError = (error: RescueFileError) => {
        resetSearchResults();
        setFileState({
            refundInvalid: error,
            rescueFile: undefined,
            rescueFileName: undefined,
            rescueFileNameKey: undefined,
        });
    };

    const handleReset = () => {
        stopSearch();
        resetSearchResults();
        setFileState({
            refundInvalid: undefined,
            rescueFile: undefined,
            rescueFileName: undefined,
            rescueFileNameKey: undefined,
        });
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
        setBtcState({
            searchState: BtcSearchState.Loading,
            error: undefined,
        });

        try {
            const restorableSwaps = await fetchPaginatedRestorableSwaps(
                currentRescueFile,
                (loadedSwaps) => setBtcState({ loadedSwaps }),
                signal,
            );
            if (signal.aborted) {
                return;
            }
            setRescuableSwaps(restorableSwaps);
            const mappedSwaps = mapRestorableSwapList(restorableSwaps);
            const enrichedSwaps = await enrichSwapsWithTempWalletData(
                currentRescueFile,
                mappedSwaps as SomeSwap[],
            );
            setBtcState({
                swaps: enrichedSwaps,
                searchState: BtcSearchState.Ready,
            });
        } catch (e) {
            if (signal.aborted) {
                return;
            }
            const error = formatError(e);
            setBtcState({
                error,
                searchState: BtcSearchState.Errored,
            });
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

        const preimageDerivation =
            action === RskRescueMode.Claim && mnemonic
                ? new PreimageHashesWorker()
                : undefined;

        const generator = scanLockupEvents(
            signal,
            target.contract,
            {
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
            },
            preimageDerivation,
        );

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
                    events.map((event: LogRefundData) => ({
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

        const setProgress = (progress: string | undefined) =>
            setEvmProgress(action, progress);
        const setUnmatched = (count: number) =>
            setEvmUnmatchedSwaps(action, count);
        const setSwaps = (events: EvmRescueResult[]) =>
            appendEvmSwaps(action, events);

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
                          setEvmState({ sweepableBalances: balances });
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
                        setSwaps,
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
        if (state.search.isSearching) {
            stopSearch();
            return;
        }

        if (!canSearch()) {
            return;
        }

        const currentRescueFile = state.file.rescueFile;
        const currentSigner = signer();

        stopSearch();
        resetSearchResults();
        setSearchState({
            hasSearched: true,
            isSearching: true,
        });

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
                setSearchState({ error: errors.join("\n") });
            }
        } catch (e) {
            if (!signal.aborted) {
                setSearchState({ error: formatError(e) });
            }
        } finally {
            if (!signal.aborted) {
                setSearchState({ isSearching: false });
                scanAbort = undefined;
            }
        }
    };

    const openResult = (result: UnifiedRescueResult) => {
        if (!result.actionable) {
            return;
        }

        if (result.source === RescueResultSource.Evm) {
            navigate(
                `/swap/rescue/evm/${result.swap.asset}/${result.swap.transactionHash}/${result.evmAction}`,
            );
            return;
        }

        if (result.source === RescueResultSource.Sweep) {
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

    onCleanup(() => {
        stopSearch();
    });

    return {
        state,
        actions: {
            backToMethodSelection,
            handleFileError,
            handleFileValidated,
            handleReset,
            startSearch,
        },
        results: {
            all: unifiedResults,
            current: currentResults,
            currentEvmProgress,
            currentPage: currentResultPage,
            hasAny: hasAnyResults,
            open: openResult,
            setCurrent: setCurrentResults,
            setCurrentPage: setCurrentResultPage,
        },
        selection: {
            activeMethods,
            canRecover,
            canSearch,
            fileErrorKey,
            rescueFileDisplayName,
            searchText,
            showResultsPage,
        },
    };
};

export type ExternalRescueSearch = ReturnType<typeof useExternalRescueSearch>;
