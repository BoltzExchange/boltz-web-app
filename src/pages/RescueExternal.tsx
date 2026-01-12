import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
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
import MnemonicInput, { rescueKeyMode } from "../components/MnemonicInput";
import Pagination, {
    desktopItemsPerPage,
    mobileItemsPerPage,
} from "../components/Pagination";
import RefundButton from "../components/RefundButton";
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
import { rescueFileTypes } from "../utils/download";
import { formatError } from "../utils/errors";
import { isMobile } from "../utils/helper";
import { validateRefundFile } from "../utils/refundFile";
import {
    RescueAction,
    createRescueList,
    getRescuableUTXOs,
} from "../utils/rescue";
import type { RescueFile } from "../utils/rescueFile";
import { getXpub, validateRescueFile } from "../utils/rescueFile";
import type { ChainSwap, SomeSwap, SubmarineSwap } from "../utils/swapCreator";
import ErrorWasm from "./ErrorWasm";
import { mapSwap } from "./RefundRescue";
import { rescueListAction } from "./Rescue";

export enum RefundError {
    InvalidData,
}

enum RefundType {
    Rescue,
    Legacy,
}

const BtcLikeLegacy = (props: {
    refundJson: Accessor<SubmarineSwap | ChainSwap>;
    refundInvalid: Accessor<RefundError | undefined>;
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
                        props.refundInvalid() == RefundError.InvalidData
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
    const [searchParams, setSearchParams] = useSearchParams();

    const [refundInvalid, setRefundInvalid] = createSignal<
        RefundError | undefined
    >(undefined);
    const [refundJson, setRefundJson] = createSignal(null);
    const [refundType, setRefundType] = createSignal<RefundType>();
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
                    source.type !== RefundType.Rescue ||
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

    const checkRefundJsonKeys = (
        json: Record<string, string | object | number>,
    ) => {
        log.debug("checking refund json");

        try {
            if ("mnemonic" in json) {
                log.info("Found rescue file");
                setRefundType(RefundType.Rescue);
                setRefundJson(validateRescueFile(json));
                rescueContext.setRescueFile(json as RescueFile);
                setRefundInvalid(undefined);
            } else {
                log.info("Found legacy refund file");

                const data = validateRefundFile(json);

                setRefundType(RefundType.Legacy);
                setRefundJson(data);
                setRefundInvalid(undefined);
            }
        } catch (e) {
            log.warn("Refund json validation failed:", formatError(e));
            setRefundType(undefined);
            setRefundInvalid(RefundError.InvalidData);
        }
    };

    const uploadChange = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        setRefundJson(null);
        setRefundInvalid(undefined);
        setSearchParams({
            page: null,
            mode: null,
        });

        if (["image/png", "image/jpg", "image/jpeg"].includes(inputFile.type)) {
            try {
                const res = await QrScanner.scanImage(inputFile, {
                    returnDetailedScanResult: true,
                });
                checkRefundJsonKeys(JSON.parse(res.data));
            } catch (e) {
                log.error("invalid QR code upload", formatError(e));
                setRefundType(undefined);
                setRefundInvalid(RefundError.InvalidData);
            }
        } else {
            try {
                const data = await inputFile.text();
                checkRefundJsonKeys(JSON.parse(data));
            } catch (e) {
                log.error("invalid file upload", formatError(e));
                setRefundType(undefined);
                setRefundInvalid(RefundError.InvalidData);
            }
        }
    };

    return (
        <>
            <Show when={searchParams.mode !== rescueKeyMode}>
                <p class="frame-text">{t("rescue_a_swap_subline")}</p>
                <hr />
            </Show>
            <Show when={refundType() === RefundType.Legacy}>
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
            <Show when={searchParams.mode === rescueKeyMode}>
                <p class="frame-text">{t("rescue_a_swap_mnemonic")}</p>
                <MnemonicInput
                    onSubmit={(mnemonic) => {
                        setRefundType(RefundType.Rescue);
                        setRefundJson(
                            validateRescueFile({ mnemonic: mnemonic }),
                        );
                        rescueContext.setRescueFile({ mnemonic: mnemonic });
                        setRefundInvalid(undefined);
                        setSearchParams({
                            mode: null,
                        });
                    }}
                />
            </Show>

            <Show when={refundType() === RefundType.Rescue}>
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
                <Show when={searchParams.mode !== rescueKeyMode}>
                    <input
                        required
                        type="file"
                        id="refundUpload"
                        data-testid="refundUpload"
                        accept={rescueFileTypes}
                        onChange={(e) => uploadChange(e)}
                    />
                </Show>
                <Switch>
                    <Match when={searchParams.mode !== rescueKeyMode}>
                        <button
                            class="btn btn-light"
                            data-testid="enterMnemonicBtn"
                            onClick={() => {
                                setRefundType(undefined);
                                setRefundJson(null);
                                setRefundInvalid(undefined);
                                rescueContext.setRescuableSwaps([]);
                                setSearchParams({
                                    page: null,
                                    mode: rescueKeyMode,
                                });
                            }}>
                            {t("enter_mnemonic")}
                        </button>
                    </Match>
                    <Match when={searchParams.mode === rescueKeyMode}>
                        <button
                            class="btn btn-light"
                            data-testid="backBtn"
                            onClick={() => {
                                setSearchParams({
                                    mode: null,
                                });
                            }}>
                            {t("back")}
                        </button>
                    </Match>
                </Switch>
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
