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
import Pagination from "../components/Pagination";
import RefundButton from "../components/RefundButton";
import SwapList, { sortSwaps } from "../components/SwapList";
import SwapListLogs from "../components/SwapListLogs";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import "../style/tabs.scss";
import { getRestorableSwaps } from "../utils/boltzClient";
import type { LogRefundData } from "../utils/contractLogs";
import { scanLogsForPossibleRefunds } from "../utils/contractLogs";
import { rescueFileTypes } from "../utils/download";
import { formatError } from "../utils/errors";
import { validateRefundFile } from "../utils/refundFile";
import {
    RescueAction,
    createRescueList,
    getRefundableUTXOs,
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

const swapsPerPage = 10;

const BtcLikeLegacy = (props: {
    refundJson: Accessor<SubmarineSwap | ChainSwap>;
    refundInvalid: Accessor<RefundError | undefined>;
}) => {
    const { t } = useGlobalContext();
    const { setRefundableUTXOs } = usePayContext();

    const [refundTxId, setRefundTxId] = createSignal<string>("");

    const swap = createMemo(() => props.refundJson());

    createResource(swap, async (swap) => {
        const utxos = await getRefundableUTXOs(swap);
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
                <p>{t("refunded")}</p>
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

    const [rescuableSwaps] = createResource(
        () => ({ refundJson: refundJson(), type: refundType() }),
        async (source) => {
            if (
                source.type !== RefundType.Rescue ||
                source.refundJson === null
            ) {
                return undefined;
            }

            const res = await getRestorableSwaps(getXpub(source.refundJson));
            rescueContext.setRescuableSwaps(res);

            return res.map((swap) => mapSwap(swap));
        },
    );

    const [refundList] = createResource(
        currentSwaps,
        async (swaps: SomeSwap[]) => {
            setLoading(true);
            return await createRescueList(swaps).finally(() =>
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
            log.warn("Refund json validation failed:", e);
            setRefundType(undefined);
            setRefundInvalid(RefundError.InvalidData);
        }
    };

    const uploadChange = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        setRefundJson(null);
        setRefundInvalid(undefined);

        if (["image/png", "image/jpg", "image/jpeg"].includes(inputFile.type)) {
            try {
                const res = await QrScanner.scanImage(inputFile, {
                    returnDetailedScanResult: true,
                });
                checkRefundJsonKeys(JSON.parse(res.data));
            } catch (e) {
                log.error("invalid QR code upload", e);
                setRefundType(undefined);
                setRefundInvalid(RefundError.InvalidData);
            }
        } else {
            try {
                const data = await inputFile.text();
                checkRefundJsonKeys(JSON.parse(data));
            } catch (e) {
                log.error("invalid file upload", e);
                setRefundType(undefined);
                setRefundInvalid(RefundError.InvalidData);
            }
        }
    };

    const getListHeight = () => ({
        // to avoid layout shift when swapping between pages with less than 5 swaps
        "min-height":
            rescuableSwaps()?.length > swapsPerPage
                ? `${45 * swapsPerPage}px`
                : "0",
    });

    return (
        <>
            <Show when={searchParams.mode !== rescueKeyMode}>
                <p>{t("rescue_a_swap_subline")}</p>
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
                <p>{t("rescue_a_swap_mnemonic")}</p>
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
                                <div style={getListHeight()}>
                                    <Show
                                        when={!loading()}
                                        fallback={
                                            <div
                                                class="center"
                                                style={getListHeight()}>
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
                                    itemsPerPage={swapsPerPage}
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                />
                            </Show>
                        </div>
                    </Match>
                    <Match when={rescuableSwaps.state === "refreshing"}>
                        <LoadingSpinner />
                    </Match>
                    <Match when={rescuableSwaps.state === "errored"}>
                        <h3 style={{ margin: "2%" }}>
                            Error: {formatError(rescuableSwaps.error)}
                        </h3>
                    </Match>
                </Switch>
            </Show>
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
            <Switch fallback={<p>{t("refund_external_explainer_rsk")}</p>}>
                <Match when={logRefundableSwaps().length > 0}>
                    <SwapListLogs swaps={logRefundableSwaps} />
                </Match>
                <Match when={refundScanProgress() !== undefined}>
                    <p>{t("refund_external_scanning_rsk")}</p>
                </Match>
                <Match when={signer() !== undefined}>
                    <p>{t("connected_wallet_no_swaps")}</p>
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
