import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import {
    For,
    Match,
    Show,
    Switch,
    createEffect,
    createSignal,
    onCleanup,
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
import { validateRefundFile } from "../utils/refundFile";
import ErrorWasm from "./ErrorWasm";

enum RefundError {
    InvalidData,
}

export const RefundBtcLike = () => {
    const { t } = useGlobalContext();

    const [refundInvalid, setRefundInvalid] = createSignal<
        RefundError | undefined
    >(undefined);
    const [refundJson, setRefundJson] = createSignal(null);
    const [refundTxId, setRefundTxId] = createSignal<string>("");

    const checkRefundJsonKeys = (
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
            try {
                const res = await QrScanner.scanImage(inputFile, {
                    returnDetailedScanResult: true,
                });
                checkRefundJsonKeys(input, JSON.parse(res.data));
            } catch (e) {
                log.error("invalid QR code upload", e);
                setRefundInvalid(RefundError.InvalidData);
                input.setCustomValidity(t("invalid_refund_file"));
            }
        } else {
            try {
                const data = await inputFile.text();
                checkRefundJsonKeys(input, JSON.parse(data));
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
            <Show when={refundTxId() === ""}>
                <hr />
                <RefundButton
                    swap={refundJson}
                    setRefundTxId={setRefundTxId}
                    buttonOverride={
                        refundInvalid() == RefundError.InvalidData
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
                    asset={refundJson().asset || refundJson().assetSend}
                    txId={refundTxId()}
                />
            </Show>
            <SettingsMenu />
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

const RefundExternal = () => {
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
                <div class="frame" data-testid="refundFrame">
                    <header>
                        <SettingsCog />
                        <h2>{t("refund_external_swap")}</h2>
                    </header>
                    <Show when={rskAvailable}>
                        <div class="tabs">
                            <For each={[tabBtc, tabRsk]}>
                                {(tab) => (
                                    <div
                                        class={`tab ${selected() === tab.value ? "active" : ""}`}
                                        onClick={() =>
                                            navigate(
                                                `/refund/external/${tab.value}`,
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

export default RefundExternal;
