import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import log from "loglevel";
import type { Accessor } from "solid-js";
import {
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

import BlockExplorer from "../components/BlockExplorer";
import ConnectWallet from "../components/ConnectWallet";
import LoadingSpinner from "../components/LoadingSpinner";
import MnemonicInput from "../components/MnemonicInput";
import Pagination, {
    desktopItemsPerPage,
    mobileItemsPerPage,
} from "../components/Pagination";
import RefundButton from "../components/RefundButton";
import RescueFileUpload, {
    RescueFileError,
    type RescueFileResult,
    RescueFileType,
    processUploadedFile,
} from "../components/RescueFileUpload";
import SwapList, { getSwapListHeight, sortSwaps } from "../components/SwapList";
import SwapListLogs from "../components/SwapListLogs";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { config } from "../config";
import { BTC, LBTC, RBTC, TBTC } from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { paginationLimit } from "../consts/Pagination";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    rescueKeyMode as rescueKeyModeConst,
    useRescueContext,
} from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import "../style/tabs.scss";
import { type RestorableSwap, getRestorableSwaps } from "../utils/boltzClient";
import type { LogRefundData, SwapContract } from "../utils/contractLogs";
import { scanLockupEvents } from "../utils/contractLogs";
import { rescueFileTypes } from "../utils/download";
import { formatError } from "../utils/errors";
import { isMobile } from "../utils/helper";
import {
    RescueAction,
    createRescueList,
    getRescuableUTXOs,
} from "../utils/rescue";
import { type RescueFile, getXpub } from "../utils/rescueFile";
import type { ChainSwap, SomeSwap, SubmarineSwap } from "../utils/swapCreator";
import { maxIterations } from "../workers/preimageHashes/constants";
import ErrorWasm from "./ErrorWasm";
import NotFound from "./NotFound";
import { mapSwap } from "./RefundRescue";
import { rescueListAction } from "./Rescue";

const BtcLikeLegacy = (props: {
    refundJson: Accessor<SubmarineSwap | ChainSwap>;
    refundInvalid: Accessor<RescueFileError | undefined>;
}) => {
    const { t } = useGlobalContext();
    const { setRefundableUTXOs } = usePayContext();

    const [refundTxId, setRefundTxId] = createSignal<string>("");

    const swap = createMemo(() => props.refundJson());

    createResource(swap, async (swap) => {
        const utxos = await getRescuableUTXOs(swap);
        setRefundableUTXOs(utxos);
    });

    onCleanup(() => {
        setRefundableUTXOs([]);
    });

    return (
        <>
            <Show when={refundTxId() === ""}>
                <hr />
                <RefundButton
                    swap={swap}
                    setRefundTxId={setRefundTxId}
                    buttonOverride={
                        props.refundInvalid() == RescueFileError.InvalidData
                            ? t("invalid_refund_file")
                            : undefined
                    }
                />
            </Show>
            <Show when={refundTxId() !== ""}>
                <hr />
                <p class="frame-text">{t("refunded")}</p>
                <hr />
                <BlockExplorer
                    typeLabel={"refund_tx"}
                    asset={
                        (props.refundJson() as never as Record<string, string>)
                            .asset || props.refundJson().assetSend
                    }
                    txId={refundTxId()}
                />
            </Show>
            <SettingsMenu />
        </>
    );
};

export const RefundBtcLike = () => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();
    const rescueContext = useRescueContext();
    const [searchParams] = useSearchParams();

    const [refundInvalid, setRefundInvalid] = createSignal<
        RescueFileError | undefined
    >(undefined);
    const [refundJson, setRefundJson] = createSignal(null);
    const [refundType, setRefundType] = createSignal<RescueFileType>();
    const [currentPage, setCurrentPage] = createSignal(1);
    const [currentSwaps, setCurrentSwaps] = createSignal<Partial<SomeSwap>[]>(
        [],
    );
    const [loading, setLoading] = createSignal(false);
    const [loadedSwaps, setLoadedSwaps] = createSignal(0);

    const fetchPaginatedSwaps = async () => {
        let startIndex = 0;
        const restorableSwaps: RestorableSwap[] = [];

        setLoadedSwaps(0);

        while (true) {
            try {
                const res = await getRestorableSwaps(getXpub(refundJson()), {
                    startIndex,
                    limit: paginationLimit,
                });

                if (res.length === 0) {
                    break;
                }

                restorableSwaps.push(...res);
                setLoadedSwaps((prev) => prev + res.length);

                startIndex += paginationLimit;
            } catch (e) {
                log.error("failed to get restorable swaps:", formatError(e));
                setLoadedSwaps(0);
                throw formatError(e);
            }
        }

        return restorableSwaps;
    };

    const [rescuableSwaps] = createResource(
        () => ({ refundJson: refundJson(), type: refundType() }),
        // eslint-disable-next-line solid/reactivity
        async (source) => {
            try {
                if (
                    source.type !== RescueFileType.Rescue ||
                    source.refundJson === null
                ) {
                    return undefined;
                }

                const res = await fetchPaginatedSwaps();
                rescueContext.setRescuableSwaps(res);

                return res.map((swap) => mapSwap(swap));
            } catch (e) {
                log.error("failed to get restorable swaps", formatError(e));
                throw e;
            }
        },
    );

    const [refundList] = createResource(
        currentSwaps,
        async (swaps: SomeSwap[]) => {
            setLoading(true);
            return await createRescueList(swaps, true).finally(() =>
                setLoading(false),
            );
        },
    );

    const handleFileValidated = (result: RescueFileResult) => {
        setRefundType(result.type);
        setRefundJson(result.data);
        setRefundInvalid(undefined);
    };

    const handleFileError = (error: RescueFileError) => {
        setRefundType(undefined);
        setRefundInvalid(error);
    };

    const handleReset = () => {
        setRefundJson(null);
        setRefundInvalid(undefined);
        setRefundType(undefined);
    };

    return (
        <>
            <Show when={searchParams.mode !== rescueKeyModeConst}>
                <p class="frame-text">{t("rescue_a_swap_subline")}</p>
                <hr />
            </Show>
            <Show when={refundType() === RescueFileType.Legacy}>
                <BtcLikeLegacy
                    refundJson={refundJson}
                    refundInvalid={refundInvalid}
                />
            </Show>
            <Show
                when={
                    refundInvalid() !== undefined &&
                    searchParams.mode !== rescueKeyModeConst
                }>
                <h3 style={{ margin: "3%", "margin-top": "4%" }}>
                    {t("invalid_refund_file")}
                </h3>
            </Show>

            <Show when={refundType() === RescueFileType.Rescue}>
                <Switch>
                    <Match when={rescuableSwaps.state === "ready"}>
                        <div style={{ "margin-top": "2%" }}>
                            <Show
                                when={rescuableSwaps()?.length > 0}
                                fallback={<h4>{t("no_swaps_found")}</h4>}>
                                <div
                                    style={getSwapListHeight(
                                        rescuableSwaps() as SomeSwap[],
                                        isMobile(),
                                    )}>
                                    <Show
                                        when={!loading()}
                                        fallback={
                                            <div
                                                class="center"
                                                style={getSwapListHeight(
                                                    rescuableSwaps() as SomeSwap[],
                                                    isMobile(),
                                                )}>
                                                <LoadingSpinner />
                                            </div>
                                        }>
                                        <SwapList
                                            swapsSignal={refundList}
                                            action={(swap) =>
                                                rescueListAction({ swap, t })
                                            }
                                            surroundingSeparators={false}
                                            onClick={(swap) => {
                                                if (
                                                    swap.action ===
                                                    RescueAction.Claim
                                                ) {
                                                    navigate(
                                                        `/rescue/claim/${swap.id}`,
                                                    );
                                                    return;
                                                }
                                                navigate(
                                                    `/rescue/refund/${swap.id}`,
                                                    {
                                                        state: {
                                                            waitForSwapTimeout:
                                                                swap.waitForSwapTimeout,
                                                        },
                                                    },
                                                );
                                            }}
                                            hideDateOnMobile
                                        />
                                    </Show>
                                </div>
                                <Pagination
                                    items={rescuableSwaps}
                                    setDisplayedItems={(swaps) =>
                                        setCurrentSwaps(swaps)
                                    }
                                    sort={sortSwaps}
                                    totalItems={rescuableSwaps().length}
                                    itemsPerPage={
                                        isMobile()
                                            ? mobileItemsPerPage
                                            : desktopItemsPerPage
                                    }
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                />
                            </Show>
                        </div>
                    </Match>
                    <Match when={rescuableSwaps.state === "refreshing"}>
                        <p class="restore-loading-progress">
                            {t("swaps_found", { count: loadedSwaps() })}
                        </p>
                        <LoadingSpinner class="restore-loading-spinner" />
                    </Match>
                    <Match when={rescuableSwaps.state === "errored"}>
                        <h3 style={{ margin: "2%" }}>
                            Error: {formatError(rescuableSwaps.error)}
                        </h3>
                    </Match>
                </Switch>
            </Show>
            <Show when={rescuableSwaps.state !== "refreshing"}>
                <RescueFileUpload
                    onFileValidated={handleFileValidated}
                    onError={handleFileError}
                    onReset={handleReset}
                />
            </Show>
        </>
    );
};

type EvmScanTarget = {
    asset: string;
    providerUrl: string;
    contract: SwapContract;
};

const getEvmScanTargets = (
    getEtherSwap: (asset: string) => SwapContract,
    getErc20Swap: (asset: string) => SwapContract,
): EvmScanTarget[] => {
    const targets: EvmScanTarget[] = [];

    const rskEndpoint = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (rskEndpoint) {
        targets.push({
            asset: RBTC,
            providerUrl: rskEndpoint,
            contract: getEtherSwap(RBTC),
        });
    }

    const arbEndpoint =
        import.meta.env.VITE_ARBITRUM_LOG_SCAN_ENDPOINT ??
        config.assets?.[TBTC]?.network?.rpcUrls?.[0];
    if (arbEndpoint && config.assets?.[TBTC]?.contracts?.deployHeight) {
        targets.push({
            asset: TBTC,
            providerUrl: arbEndpoint,
            contract: getErc20Swap(TBTC),
        });
    }

    return targets;
};

export const RescueEvm = (props: { mode?: string }) => {
    const { t } = useGlobalContext();
    const navigate = useNavigate();
    const params = useParams();
    const [searchParams] = useSearchParams();
    const { signer, getEtherSwap, getErc20Swap } = useWeb3Signer();
    const { setEvmRescuableSwaps, resetRescueKey } = useRescueContext();

    const rescueMode = () => {
        if (props.mode === RskRescueMode.Refund) return RskRescueMode.Refund;
        if (props.mode === RskRescueMode.Claim) return RskRescueMode.Claim;
        return undefined;
    };

    const inputMode = () => searchParams.mode;
    const [logRefundableSwaps, setLogRefundableSwaps] = createSignal<
        LogRefundData[] | undefined
    >(undefined);
    const [refundScanProgress, setRefundScanProgress] = createSignal<
        string | undefined
    >(undefined);
    const [isScanning, setIsScanning] = createSignal(false);
    const [uploadedRescueFile, setUploadedRescueFile] =
        createSignal<RescueFile>();
    const [rescueFileError, setRescueFileError] = createSignal<string | null>(
        null,
    );
    const [unmatchedSwaps, setUnmatchedSwaps] = createSignal(0);

    let refundScanAbort: AbortController | undefined = undefined;

    const stopScan = () => {
        if (refundScanAbort) {
            refundScanAbort.abort("scan stopped");
            refundScanAbort = undefined;
        }
        setIsScanning(false);
        setRefundScanProgress(undefined);
        setUnmatchedSwaps(0);
    };

    const runSingleScan = async (
        target: EvmScanTarget,
        signerAddress: string,
        action: RskRescueMode,
        mnemonic?: string,
    ) => {
        const generator = scanLockupEvents(
            refundScanAbort.signal,
            target.contract,
            {
                asset: target.asset as import("../consts/Assets").AssetType,
                providerUrl: target.providerUrl,
                filter: { address: signerAddress },
                action,
                mnemonic,
            },
        );

        for await (const { events, unmatchedSwaps: unmatched } of generator) {
            if (refundScanAbort?.signal.aborted) {
                break;
            }

            if (events.length > 0) {
                const updatedSwaps = (logRefundableSwaps() ?? []).concat(
                    events,
                );
                setLogRefundableSwaps(updatedSwaps);
                setEvmRescuableSwaps(updatedSwaps);
            }
            setUnmatchedSwaps((prev) => prev + unmatched);
        }
    };

    const startScan = async () => {
        const currentSigner = signer();

        if (currentSigner === undefined) {
            return;
        }

        const action = rescueMode();
        if (action === undefined) return;

        setIsScanning(true);
        setLogRefundableSwaps([]);
        setUnmatchedSwaps(0);
        setRefundScanProgress(
            t("logs_scan_progress", {
                value: Number(0).toFixed(2),
            }),
        );

        refundScanAbort = new AbortController();

        const signerAddress = await currentSigner.getAddress();
        const rescueFile = uploadedRescueFile();

        if (action === RskRescueMode.Refund) {
            const targets = getEvmScanTargets(
                getEtherSwap as (a: string) => SwapContract,
                getErc20Swap as (a: string) => SwapContract,
            );
            await Promise.all(
                targets.map((target) =>
                    runSingleScan(target, signerAddress, action),
                ),
            );
        } else {
            const rskEndpoint = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
            if (!rskEndpoint) return;

            const generator = scanLockupEvents(
                refundScanAbort.signal,
                getEtherSwap(RBTC),
                {
                    asset: RBTC,
                    providerUrl: rskEndpoint,
                    filter: { address: signerAddress },
                    action,
                    mnemonic: rescueFile?.mnemonic,
                },
            );

            for await (const {
                progress,
                events,
                derivedKeys,
                unmatchedSwaps,
            } of generator) {
                if (refundScanAbort?.signal.aborted) {
                    break;
                }
                setRefundScanProgress(
                    progress === 1
                        ? t("searching_resumable_swaps", {
                              progress: Math.floor(
                                  ((derivedKeys ?? 0) / maxIterations) * 100,
                              ).toFixed(2),
                          })
                        : t("logs_scan_progress", {
                              value: (progress * 100).toFixed(2),
                          }),
                );

                const updatedSwaps = (logRefundableSwaps() ?? []).concat(
                    events,
                );
                setLogRefundableSwaps(updatedSwaps);
                setEvmRescuableSwaps(updatedSwaps);
                setUnmatchedSwaps(unmatchedSwaps);
            }
        }

        if (!refundScanAbort?.signal.aborted) {
            setIsScanning(false);
            setRefundScanProgress(undefined);
        }
    };

    const { rescueFile: rescueFileFromContext, validRescueKey } =
        useRescueContext();

    createEffect(() => {
        if (validRescueKey()) {
            const data = rescueFileFromContext();
            if (!data) return;
            log.info("Valid rescue key entered");
            setRescueFileError(null);
            setUploadedRescueFile(data);
        }
    });

    const handleFileUpload = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        if (!inputFile) return;

        try {
            const result = await processUploadedFile(inputFile);

            if (!Object.values(RescueFileType).includes(result.type)) {
                throw new Error("invalid rescue file type: " + result.type);
            }

            setRescueFileError(null);
            setUploadedRescueFile(result.data as RescueFile);
        } catch (err) {
            log.error("invalid file upload", formatError(err));
            setRescueFileError(t("invalid_refund_file"));
        }
    };

    createEffect(() => {
        if (signer() === undefined) {
            if (isScanning()) {
                stopScan();
            }
            setLogRefundableSwaps(undefined);
            setUploadedRescueFile(undefined);
            setUnmatchedSwaps(0);
        }
    });

    onCleanup(() => {
        stopScan();
        resetRescueKey();
    });

    const basePath = `/rescue/external/${params.type?.toLowerCase() ?? ""}`;

    const ModeSelector = () => (
        <>
            <p class="frame-text">{t("rsk_rescue_prompt")}</p>
            <hr />
            <div style={{ display: "flex", gap: "12px" }}>
                <button
                    data-testid="rsk-rescue-refund-button"
                    class="btn btn-light"
                    onClick={() =>
                        navigate(`${basePath}/${RskRescueMode.Refund}`)
                    }>
                    {t("rsk_rescue_refund_title")}
                    <br />
                </button>

                <button
                    data-testid="rsk-rescue-resume-button"
                    class="btn btn-light"
                    onClick={() =>
                        navigate(`${basePath}/${RskRescueMode.Claim}`)
                    }>
                    {t("rsk_rescue_resume_title")}
                </button>
            </div>
        </>
    );

    const ScanningStatus = () => (
        <Switch>
            <Match when={isScanning()}>
                <p class="frame-text">{t("refund_external_scanning_evm")}</p>
            </Match>
            <Match
                when={
                    !isScanning() &&
                    logRefundableSwaps() !== undefined &&
                    logRefundableSwaps().length === 0 &&
                    unmatchedSwaps() === 0
                }>
                <h3>{t("connected_wallet_no_swaps")}</h3>
                <button
                    class="btn btn-light"
                    onClick={() => navigate(basePath)}>
                    {t("back")}
                </button>
            </Match>
            <Match when={unmatchedSwaps() > 0}>
                <p class="frame-text">
                    {t("unmatched_swaps", { count: unmatchedSwaps() })}
                </p>
            </Match>
        </Switch>
    );

    const showMnemonicMode = () => inputMode() === rescueKeyModeConst;

    const RescueKeyInput = () => (
        <>
            <Show when={!showMnemonicMode()}>
                <input
                    required
                    type="file"
                    id="refundUpload"
                    data-testid="refundUpload"
                    accept={rescueFileTypes}
                    onChange={handleFileUpload}
                />
                <Show when={!uploadedRescueFile()}>
                    <p style={{ margin: "5px 0" }}>{t("or")}</p>
                    <button
                        class="btn btn-light"
                        onClick={() =>
                            navigate(
                                `${basePath}/${RskRescueMode.Claim}?mode=${rescueKeyModeConst}`,
                            )
                        }>
                        {t("enter_mnemonic")}
                    </button>
                </Show>
            </Show>
            <Show when={showMnemonicMode()}>
                <MnemonicInput />
            </Show>
        </>
    );

    const ScanMode = (props: {
        explainerKey: string;
        requiresRescueFile?: boolean;
    }) => {
        const canScan = () =>
            signer() !== undefined &&
            (!props.requiresRescueFile || uploadedRescueFile());

        createEffect(() => {
            if (
                canScan() &&
                !isScanning() &&
                logRefundableSwaps() === undefined
            ) {
                void startScan();
            }
        });

        return (
            <>
                <Show
                    when={!isScanning() && logRefundableSwaps() === undefined}>
                    <p class="frame-text-spaced">
                        {t(props.explainerKey as Parameters<typeof t>[0])}
                    </p>
                    <hr />
                </Show>

                <Show when={rescueFileError()}>
                    <h3 class="frame-text-spaced">{rescueFileError()}</h3>
                </Show>

                <ScanningStatus />

                <Show when={logRefundableSwaps()?.length > 0}>
                    <SwapListLogs
                        swaps={logRefundableSwaps}
                        action={rescueMode()}
                    />
                </Show>

                <Show
                    when={!isScanning() && logRefundableSwaps() === undefined}>
                    <Show when={props.requiresRescueFile}>
                        <RescueKeyInput />
                    </Show>
                </Show>
                <ConnectWallet
                    asset={RBTC}
                    skipNetworkCheck={true}
                    addressOverride={refundScanProgress}
                />
            </>
        );
    };

    return (
        <Switch fallback={<ModeSelector />}>
            <Match when={rescueMode() === RskRescueMode.Refund}>
                <ScanMode explainerKey="evm_rescue_refund_explainer" />
            </Match>
            <Match when={rescueMode() === RskRescueMode.Claim}>
                <ScanMode
                    explainerKey="rsk_rescue_resume_explainer"
                    requiresRescueFile
                />
            </Match>
        </Switch>
    );
};

const RescueExternal = () => {
    const { t, wasmSupported } = useGlobalContext();

    const params = useParams();
    const navigate = useNavigate();

    const evmAvailable =
        import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT !== undefined ||
        import.meta.env.VITE_ARBITRUM_LOG_SCAN_ENDPOINT !== undefined ||
        config.assets?.[TBTC]?.network?.rpcUrls?.[0] !== undefined;

    const tabBtc = {
        name: "Bitcoin / Liquid",
        values: [BTC, LBTC],
    };
    const tabEvm = { name: "EVM", values: [RBTC, TBTC, "RSK"] };
    const validTypes = evmAvailable
        ? [...tabBtc.values, ...tabEvm.values]
        : [...tabBtc.values];

    const selected = () =>
        params.type?.toLowerCase() ?? tabBtc.values[0].toLowerCase();

    if (!evmAvailable) {
        log.warn("No EVM log scan endpoints available");
    }

    const validType = () =>
        params.type === undefined ||
        validTypes.includes(params.type.toUpperCase());

    return (
        <Show when={validType()} fallback={<NotFound />}>
            <Show when={wasmSupported()} fallback={<ErrorWasm />}>
                <div id="refund">
                    <div class="frame refund" data-testid="refundFrame">
                        <header>
                            <SettingsCog />
                            <h2>{t("rescue_external_swap")}</h2>
                        </header>
                        <Show when={evmAvailable}>
                            <div class="tabs">
                                <For each={[tabBtc, tabEvm]}>
                                    {(tab) => (
                                        <div
                                            class={`tab ${tab.values.includes(selected().toUpperCase()) ? "active" : ""}`}
                                            onClick={() =>
                                                navigate(
                                                    `/rescue/external/${tab.values[0].toLowerCase()}`,
                                                )
                                            }>
                                            {tab.name}
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                        <Show
                            when={tabBtc.values.includes(
                                selected().toUpperCase(),
                            )}>
                            <RefundBtcLike />
                        </Show>
                        <Show
                            when={
                                evmAvailable &&
                                tabEvm.values.includes(
                                    selected().toUpperCase(),
                                )
                            }>
                            <RescueEvm mode={params.mode} />
                        </Show>
                        <SettingsMenu />
                    </div>
                </div>
            </Show>
        </Show>
    );
};

export default RescueExternal;
