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
import { rescueKeyMode } from "../components/MnemonicInput";
import Pagination, {
    desktopItemsPerPage,
    mobileItemsPerPage,
} from "../components/Pagination";
import RefundButton from "../components/RefundButton";
import RescueFileUpload, {
    RescueFileError,
    type RescueFileResult,
    RescueFileType,
} from "../components/RescueFileUpload";
import SwapList, { getSwapListHeight, sortSwaps } from "../components/SwapList";
import SwapListLogs from "../components/SwapListLogs";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { paginationLimit } from "../consts/Pagination";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import "../style/tabs.scss";
import { type RestorableSwap, getRestorableSwaps } from "../utils/boltzClient";
import type { LogRefundData } from "../utils/contractLogs";
import { scanLockupEvents } from "../utils/contractLogs";
import { formatError } from "../utils/errors";
import { isMobile } from "../utils/helper";
import {
    RescueAction,
    createRescueList,
    getRescuableUTXOs,
} from "../utils/rescue";
import { type RescueFile, getXpub } from "../utils/rescueFile";
import type { ChainSwap, SomeSwap, SubmarineSwap } from "../utils/swapCreator";
import ErrorWasm from "./ErrorWasm";
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
            <Show when={searchParams.mode !== rescueKeyMode}>
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
                    searchParams.mode !== rescueKeyMode
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

type RskRescueMode = "refund" | "resume";

export const RescueRsk = () => {
    const { t } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();
    const { setRskRescuableSwaps } = useRescueContext();

    const [mode, setMode] = createSignal<RskRescueMode | undefined>(undefined);
    const [logRefundableSwaps, setLogRefundableSwaps] = createSignal<
        LogRefundData[] | undefined
    >(undefined);
    const [refundScanProgress, setRefundScanProgress] = createSignal<
        string | undefined
    >(undefined);
    const [isScanning, setIsScanning] = createSignal(false);
    const [uploadedRescueFile, setUploadedRescueFile] =
        createSignal<RescueFile>();

    let refundScanAbort: AbortController | undefined = undefined;

    const stopScan = () => {
        if (refundScanAbort) {
            refundScanAbort.abort("scan stopped");
            refundScanAbort = undefined;
        }
        setIsScanning(false);
        setRefundScanProgress(undefined);
    };

    const startScan = async () => {
        const currentSigner = signer();

        if (currentSigner === undefined) {
            return;
        }

        setIsScanning(true);
        setLogRefundableSwaps([]);

        setRefundScanProgress(
            t("logs_scan_progress", {
                value: Number(0).toFixed(2),
            }),
        );

        refundScanAbort = new AbortController();

        const signerAddress = await currentSigner.getAddress();
        const rescueFile = uploadedRescueFile();

        const generator = scanLockupEvents(refundScanAbort.signal, getEtherSwap(), {
            filter: { address: signerAddress },
            checkLocked: true,
            derivePreimages: rescueFile ? { mnemonic: rescueFile.mnemonic } : undefined,
        });

        for await (const { progress, events } of generator) {
            if (refundScanAbort?.signal.aborted) {
                break;
            }
            setRefundScanProgress(
                t("logs_scan_progress", {
                    value: (progress * 100).toFixed(2),
                }),
            );

            const updatedSwaps = logRefundableSwaps().concat(events);
            setLogRefundableSwaps(updatedSwaps);
            setRskRescuableSwaps(updatedSwaps);
        }

        if (!refundScanAbort?.signal.aborted) {
            setIsScanning(false);
            setRefundScanProgress(undefined);
        }
    };

    const handleRescueFileUpload = (result: RescueFileResult) => {
        if (result.type === RescueFileType.Rescue) {
            setUploadedRescueFile(result.data as RescueFile);
        }
    };

    const resetMode = () => {
        stopScan();
        setMode(undefined);
        setLogRefundableSwaps(undefined);
        setUploadedRescueFile(undefined);
    };

    createEffect(() => {
        if (signer() === undefined) {
            if (isScanning()) {
                stopScan();
            }
            setLogRefundableSwaps([]);
        }
    });

    onCleanup(() => {
        stopScan();
    });

    // Mode selection screen
    const ModeSelector = () => (
        <>
            <p class="frame-text">{t("rsk_rescue_prompt")}</p>

            <div style={{ display: "flex", gap: "12px" }}>
                <button class="btn btn-light" onClick={() => setMode("refund")}>
                    {t("rsk_rescue_refund_title")}<br />
                </button>

                <button class="btn btn-light" onClick={() => setMode("resume")}>
                    {t("rsk_rescue_resume_title")}<br />
                    ({t("rsk_rescue_resume_tagline")})
                </button>
            </div>

            <p class="frame-text" style={{ "margin": "10px 0 10px 0" }}>
                {t("rsk_rescue_no_key_note_title")}<br />
                {t("rsk_rescue_no_key_note_subtitle")}
            </p>
        </>
    );

    // Scanning UI (shared between modes)
    const ScanningStatus = () => (
        <Switch>
            <Match when={isScanning()}>
                <p class="frame-text">
                    {t("refund_external_scanning_rsk")}
                </p>
                <p class="frame-text">{refundScanProgress()}</p>
            </Match>
            <Match
                when={
                    logRefundableSwaps() !== undefined &&
                    logRefundableSwaps().length === 0
                }>
                <p class="frame-text">{t("connected_wallet_no_swaps")}</p>
            </Match>
        </Switch>
    );

    // Shared scan UI for both modes
    const ScanMode = (props: { explainerKey: string; requiresRescueFile?: boolean }) => {
        const canScan = () => signer() !== undefined && (!props.requiresRescueFile || uploadedRescueFile());

        return (
            <>
                <Show when={!isScanning() && logRefundableSwaps() === undefined}>
                    <p class="frame-text">{t(props.explainerKey as Parameters<typeof t>[0])}</p>
                </Show>

                <ScanningStatus />

                <Show when={logRefundableSwaps()?.length > 0}>
                    <SwapListLogs swaps={logRefundableSwaps} />
                </Show>

                <Show when={!isScanning()}>
                    <Show when={props.requiresRescueFile}>
                        <RescueFileUpload
                            onFileValidated={handleRescueFileUpload}
                            onError={() => setUploadedRescueFile(null)}
                            onReset={() => setUploadedRescueFile(null)}
                            showMnemonicOption={false}
                        />
                    </Show>

                    <ConnectWallet />
                </Show>

                <button
                    class="btn"
                    disabled={!canScan()}
                    onClick={() => (isScanning() ? stopScan() : startScan())}>
                    {isScanning()
                        ? t("stop_scan")
                        : canScan()
                            ? t("start_scan")
                            : props.requiresRescueFile
                                ? t("upload_key_and_connect_to_scan")
                                : t("connect_wallet_to_scan")}
                </button>

                <Show when={!isScanning()}>
                    <button class="btn btn-light" onClick={resetMode}>
                        {t("back")}
                    </button>
                </Show>
            </>
        );
    };

    return (
        <Switch fallback={<ModeSelector />}>
            <Match when={mode() === "refund"}>
                <ScanMode explainerKey="rsk_rescue_refund_explainer" />
            </Match>
            <Match when={mode() === "resume"}>
                <ScanMode explainerKey="rsk_rescue_resume_explainer" requiresRescueFile />
            </Match>
        </Switch>
    );
};

const RescueExternal = () => {
    const { wasmSupported, t } = useGlobalContext();

    const params = useParams();
    const navigate = useNavigate();

    const tabBtc = { name: "Bitcoin / Liquid", value: "btc" };
    const tabRsk = { name: "Rootstock", value: "rsk" };

    const selected = () => params.type ?? tabBtc.value;

    const rskAvailable =
        import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT !== undefined;
    if (!rskAvailable) {
        log.warn("RSK log scan endpoint not available");
    }

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame refund" data-testid="refundFrame">
                    <header>
                        <SettingsCog />
                        <h2>{t("rescue_external_swap")}</h2>
                    </header>
                    <Show when={rskAvailable}>
                        <div class="tabs">
                            <For each={[tabBtc, tabRsk]}>
                                {(tab) => (
                                    <div
                                        class={`tab ${selected() === tab.value ? "active" : ""}`}
                                        onClick={() =>
                                            navigate(
                                                `/rescue/external/${tab.value}`,
                                            )
                                        }>
                                        {tab.name}
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                    <Show when={selected() === tabBtc.value}>
                        <RefundBtcLike />
                    </Show>
                    <Show when={selected() === tabRsk.value}>
                        <RescueRsk />
                    </Show>
                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default RescueExternal;
