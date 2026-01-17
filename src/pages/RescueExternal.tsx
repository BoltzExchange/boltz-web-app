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
import { scanLogsForPossibleRefunds } from "../utils/contractLogs";
import { formatError } from "../utils/errors";
import { isMobile } from "../utils/helper";
import {
    RescueAction,
    createRescueList,
    getRescuableUTXOs,
} from "../utils/rescue";
import { getXpub } from "../utils/rescueFile";
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

export const RefundRsk = () => {
    const { t } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();

    const [logRefundableSwaps, setLogRefundableSwaps] = createSignal<
        LogRefundData[]
    >([]);
    const [refundScanProgress, setRefundScanProgress] = createSignal<
        string | undefined
    >(undefined);

    let refundScanAbort: AbortController | undefined = undefined;

    onCleanup(() => {
        if (refundScanAbort) {
            refundScanAbort.abort();
        }
    });

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        setLogRefundableSwaps([]);

        if (refundScanAbort !== undefined) {
            refundScanAbort.abort("signer changed");
        }

        if (signer() === undefined) {
            return;
        }

        setRefundScanProgress(
            t("logs_scan_progress", {
                value: Number(0).toFixed(2),
            }),
        );

        refundScanAbort = new AbortController();

        const generator = scanLogsForPossibleRefunds(
            refundScanAbort.signal,
            signer(),
            getEtherSwap(),
        );

        for await (const value of generator) {
            setRefundScanProgress(
                t("logs_scan_progress", {
                    value: (value.progress * 100).toFixed(2),
                }),
            );
            setLogRefundableSwaps(logRefundableSwaps().concat(value.events));
        }

        setRefundScanProgress(undefined);
    });

    return (
        <>
            <Switch
                fallback={
                    <p class="frame-text">
                        {t("refund_external_explainer_rsk")}
                    </p>
                }>
                <Match when={logRefundableSwaps().length > 0}>
                    <SwapListLogs swaps={logRefundableSwaps} />
                </Match>
                <Match when={refundScanProgress() !== undefined}>
                    <p class="frame-text">
                        {t("refund_external_scanning_rsk")}
                    </p>
                </Match>
                <Match when={signer() !== undefined}>
                    <p class="frame-text">{t("connected_wallet_no_swaps")}</p>
                </Match>
            </Switch>
            <hr />
            <ConnectWallet addressOverride={refundScanProgress} />
        </>
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
                        <RefundRsk />
                    </Show>
                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default RescueExternal;
