import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal, onMount } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import SettingsCog from "../components/SettingsCog";
import SettingsMenu from "../components/SettingsMenu";
import SwapList from "../components/SwapList";
import { swapStatusFailed, swapStatusSuccess } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { getSubmarineTransaction, getSwapStatus } from "../utils/boltzClient";
import { refundJsonKeys, refundJsonKeysLiquid } from "../utils/refund";
import ErrorWasm from "./ErrorWasm";

const Refund = () => {
    const navigate = useNavigate();
    const { getSwap, getSwaps, updateSwapStatus, wasmSupported, t } =
        useGlobalContext();
    const { setTimeoutEta, setTimeoutBlockheight } = usePayContext();

    const [swapFound, setSwapFound] = createSignal(null);
    const [refundInvalid, setRefundInvalid] = createSignal(false);
    const [refundJson, setRefundJson] = createSignal(null);
    const [refundTxId, setRefundTxId] = createSignal<string>("");

    setTimeoutBlockheight(null);
    setTimeoutEta(null);

    const checkRefundJsonKeys = async (input: HTMLInputElement, json: any) => {
        log.debug("checking refund json", json);

        if ("id" in json && json.id !== undefined) {
            // When the swap id is found in the local storage, there is no need for the validation,
            // all relevant data is there already, and we just need to show the button to redirect
            const localStorageSwap = await getSwap(json.id);
            if (localStorageSwap !== null) {
                setSwapFound(json.id);
                return;
            }

            // Compatibility with the old refund files
            if (json.asset === undefined && json.currency) {
                json.asset = json.currency;
            }

            const requiredKeys =
                json.asset !== "L-BTC" ? refundJsonKeys : refundJsonKeysLiquid;
            const valid = requiredKeys.every((key) => key in json);

            if (valid) {
                setRefundJson(json);
                return;
            }
        }

        setRefundInvalid(true);
        input.setCustomValidity(t("invalid_refund_file"));
    };

    const uploadChange = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        setRefundJson(null);
        setSwapFound(null);
        setRefundInvalid(false);

        if (inputFile.type === "image/png") {
            QrScanner.scanImage(inputFile, { returnDetailedScanResult: true })
                .then((result) =>
                    checkRefundJsonKeys(input, JSON.parse(result.data)),
                )
                .catch((e) => {
                    log.error("invalid QR code upload", e);
                    setRefundInvalid(true);
                    input.setCustomValidity(t("invalid_refund_file"));
                });
        } else {
            inputFile
                .text()
                .then(async (result) => {
                    await checkRefundJsonKeys(input, JSON.parse(result));
                })
                .catch((e) => {
                    log.error("invalid file upload", e);
                    setRefundInvalid(true);
                    input.setCustomValidity(t("invalid_refund_file"));
                });
        }
    };

    const refundSwapsSanityFilter = (swap: any) =>
        !swap.reverse && swap.refundTx === undefined;

    const [refundableSwaps, setRefundableSwaps] = createSignal([]);

    const addToRefundableSwaps = (swap: any) => {
        setRefundableSwaps(refundableSwaps().concat(swap));
    };

    onMount(async () => {
        const swapsToRefund = (await getSwaps())
            .filter(refundSwapsSanityFilter)
            .filter((swap) =>
                [
                    swapStatusFailed.InvoiceFailedToPay,
                    swapStatusFailed.TransactionLockupFailed,
                ].includes(swap.status),
            );
        setRefundableSwaps(swapsToRefund);

        (await getSwaps())
            .filter(refundSwapsSanityFilter)
            .filter(
                (swap) =>
                    swap.status !== swapStatusSuccess.TransactionClaimed &&
                    swapsToRefund.find((found) => found.id === swap.id) ===
                        undefined,
            )
            .map(async (swap) => {
                try {
                    const res = await getSwapStatus(swap.assetSend, swap.id);
                    if (
                        !(await updateSwapStatus(swap.id, res.status)) &&
                        Object.values(swapStatusFailed).includes(res.status)
                    ) {
                        if (res.status !== swapStatusFailed.SwapExpired) {
                            addToRefundableSwaps(swap);
                            return;
                        }

                        // Make sure coins were locked for the swap with status "swap.expired"
                        await getSubmarineTransaction(swap.assetSend, swap.id);
                        addToRefundableSwaps(swap);
                    }
                } catch (e) {
                    log.warn("failed to get swap status", swap.id, e);
                }
            });
    });

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame" data-testid="refundFrame">
                    <SettingsCog />
                    <h2>{t("refund_a_swap")}</h2>
                    <p>{t("refund_a_swap_subline")}</p>
                    <hr />
                    <Show when={refundableSwaps().length > 0}>
                        <SwapList swapsSignal={refundableSwaps} />
                        <hr />
                    </Show>
                    <input
                        required
                        type="file"
                        id="refundUpload"
                        data-testid="refundUpload"
                        accept="application/json,image/png"
                        onChange={(e) => uploadChange(e)}
                    />
                    <Show when={swapFound() !== null}>
                        <hr />
                        <p>{t("swap_in_history")}</p>
                        <button
                            class="btn btn-success"
                            onClick={() => navigate(`/swap/${swapFound()}`)}>
                            {t("open_swap")}
                        </button>
                    </Show>
                    <Show when={refundInvalid()}>
                        <hr />
                        <button class="btn" disabled={true}>
                            {t("invalid_refund_file")}
                        </button>
                    </Show>
                    <Show when={refundTxId() === "" && refundJson() !== null}>
                        <hr />
                        <RefundButton
                            swap={refundJson}
                            setRefundTxId={setRefundTxId}
                        />
                        <RefundEta />
                    </Show>
                    <Show when={refundTxId() !== ""}>
                        <hr />
                        <p>{t("refunded")}</p>
                        <hr />
                        <BlockExplorer
                            typeLabel={"refund_tx"}
                            asset={refundJson().asset}
                            txId={refundTxId()}
                        />
                    </Show>
                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default Refund;
