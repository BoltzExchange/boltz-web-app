import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import {
    Match,
    Show,
    Switch,
    createEffect,
    createSignal,
    onCleanup,
    onMount,
} from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import ConnectWallet from "../components/ConnectWallet";
import RefundButton from "../components/RefundButton";
import SwapListLogs from "../components/SwapListLogs";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import "../style/tabs.scss";
import {
    LogRefundData,
    scanLogsForPossibleRefunds,
} from "../utils/contractLogs";
import { qrScanProbe } from "../utils/qrScanProbe";
import { validateRefundFile } from "../utils/refundFile";
import ErrorWasm from "./ErrorWasm";

enum RefundError {
    InvalidData,
    QrScanNotSupported,
}

const RefundBtcLike = () => {
    const { t } = useGlobalContext();

    const [refundInvalid, setRefundInvalid] = createSignal<
        RefundError | undefined
    >(undefined);
    const [refundJson, setRefundJson] = createSignal(null);
    const [refundTxId, setRefundTxId] = createSignal<string>("");

    const checkRefundJsonKeys = async (
        input: HTMLInputElement,
        json: Record<string, string | object | number>,
    ) => {
        log.debug("checking refund json", json);

        try {
            const data = validateRefundFile(json);

            setRefundJson(data);
            setRefundInvalid(undefined);
        } catch (e) {
            log.warn("Refund json validation failed", e);
            setRefundInvalid(RefundError.InvalidData);
            input.setCustomValidity(t("invalid_refund_file"));
        }
    };

    const uploadChange = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        setRefundJson(null);
        setRefundInvalid(undefined);

        if (["image/png", "image/jpg", "image/jpeg"].includes(inputFile.type)) {
            if (!(await qrScanProbe())) {
                setRefundInvalid(RefundError.QrScanNotSupported);
                return;
            }

            try {
                const res = await QrScanner.scanImage(inputFile, {
                    returnDetailedScanResult: true,
                });
                await checkRefundJsonKeys(input, JSON.parse(res.data));
            } catch (e) {
                log.error("invalid QR code upload", e);
                setRefundInvalid(RefundError.InvalidData);
                input.setCustomValidity(t("invalid_refund_file"));
            }
        } else {
            try {
                const data = await inputFile.text();
                await checkRefundJsonKeys(input, JSON.parse(data));
            } catch (e) {
                log.error("invalid file upload", e);
                setRefundInvalid(RefundError.InvalidData);
                input.setCustomValidity(t("invalid_refund_file"));
            }
        }
    };

    return (
        <>
            <p>{t("refund_a_swap_subline")}</p>
            <input
                required
                type="file"
                id="refundUpload"
                data-testid="refundUpload"
                accept="application/json,image/png,imagine/jpg,image/jpeg"
                onChange={(e) => uploadChange(e)}
            />
            <Show when={refundInvalid() !== undefined}>
                <hr />
                <button class="btn" disabled={true}>
                    {(() => {
                        switch (refundInvalid()) {
                            case RefundError.InvalidData:
                                return t("invalid_refund_file");

                            case RefundError.QrScanNotSupported:
                                return t("qr_scan_supported");
                        }
                    })()}
                </button>
            </Show>
            <Show when={refundTxId() === "" && refundJson() !== null}>
                <hr />
                <RefundButton swap={refundJson} setRefundTxId={setRefundTxId} />
            </Show>
            <Show when={refundTxId() !== ""}>
                <hr />
                <p>{t("refunded")}</p>
                <hr />
                <BlockExplorer
                    typeLabel={"refund_tx"}
                    asset={refundJson().asset || refundJson().assetSend}
                    txId={refundTxId()}
                />
            </Show>
            <SettingsMenu />
        </>
    );
};

const RefundRsk = () => {
    const { t } = useGlobalContext();
    const { signer, providers, getEtherSwap } = useWeb3Signer();

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
        <Show
            when={import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT !== undefined}
            fallback={<p>{t("rsk_log_endpoint_not_available")}</p>}>
            <Switch fallback={<p>{t("refund_external_explainer_rsk")}</p>}>
                <Match when={logRefundableSwaps().length > 1}>
                    <SwapListLogs swaps={logRefundableSwaps} />
                </Match>
                <Match when={refundScanProgress() !== undefined}>
                    <p>{refundScanProgress()}</p>
                </Match>
                <Match when={signer() !== undefined}>
                    <p>{t("connected_wallet_no_swaps")}</p>
                </Match>
            </Switch>
            <hr />
            <ConnectWallet addressOverride={refundScanProgress} />
        </Show>
    );
};

const RefundExternal = () => {
    const { wasmSupported, t } = useGlobalContext();

    const params = useParams();
    const navigate = useNavigate();

    const tabBtc = { name: "Bitcoin / Liquid", value: "btc" };
    const tabRsk = { name: "Rootstock", value: "rsk" };

    const selected = () => params.type ?? tabBtc.value;

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame" data-testid="refundFrame">
                    <SettingsCog />
                    <h2>{t("refund_external_swap")}</h2>
                    <hr />
                    <div class="tabs">
                        {[tabBtc, tabRsk].map((tab) => (
                            <div
                                class={`tab ${selected() === tab.value ? "active" : ""}`}
                                onClick={() =>
                                    navigate(`/refund/external/${tab.value}`)
                                }>
                                {tab.name}
                            </div>
                        ))}
                    </div>
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

export default RefundExternal;