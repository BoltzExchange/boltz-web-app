import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createEffect, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import SwapList from "../components/SwapList";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { getSubmarineTransaction, getSwapStatus } from "../utils/boltzClient";
import { refundJsonKeys, refundJsonKeysLiquid } from "../utils/refund";
import { swapStatusFailed, swapStatusSuccess } from "../utils/swapStatus";
import ErrorWasm from "./ErrorWasm";

const Refund = () => {
    const navigate = useNavigate();
    const { updateSwapStatus, swaps, refundTx, t, wasmSupported } =
        useGlobalContext();
    const { setTimeoutEta, setTimeoutBlockheight } = usePayContext();

    const [refundJson, setRefundJson] = createSignal(null);

    setTimeoutBlockheight(null);
    setTimeoutEta(null);

    const checkRefundJsonKeys = (input: HTMLInputElement, json: any) => {
        log.debug("checking refund json", json);

        // Redirect to normal flow if swap is in local storage
        const localStorageSwap = swaps().find((s) => s.id === json.id);
        if (localStorageSwap !== undefined) {
            navigate("/swap/" + json.id);
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
        } else {
            input.setCustomValidity(t("invalid_refund_file"));
        }
    };

    const uploadChange = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        setRefundJson(null);

        if (inputFile.type === "image/png") {
            QrScanner.scanImage(inputFile, { returnDetailedScanResult: true })
                .then((result) =>
                    checkRefundJsonKeys(input, JSON.parse(result.data)),
                )
                .catch((e) => {
                    log.error("invalid QR code upload", e);
                    input.setCustomValidity(t("invalid_refund_file"));
                });
        } else {
            new Response(inputFile)
                .json()
                .then((result) => checkRefundJsonKeys(input, result))
                .catch((e) => {
                    log.error("invalid file upload", e);
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

    createEffect(() => {
        const swapsToRefund = swaps()
            .filter(refundSwapsSanityFilter)
            .filter((swap) =>
                [
                    swapStatusFailed.InvoiceFailedToPay,
                    swapStatusFailed.TransactionLockupFailed,
                ].includes(swap.status),
            );
        setRefundableSwaps(swapsToRefund);

        swaps()
            .filter(refundSwapsSanityFilter)
            .filter(
                (swap) =>
                    swap.status !== swapStatusSuccess.TransactionClaimed &&
                    swapsToRefund.find((found) => found.id === swap.id) ===
                        undefined,
            )
            .map(async (swap) => {
                const res = await getSwapStatus(swap.asset, swap.id);
                if (
                    !updateSwapStatus(swap.id, res.status) &&
                    Object.values(swapStatusFailed).includes(res.status)
                ) {
                    if (res.status !== swapStatusFailed.SwapExpired) {
                        addToRefundableSwaps(swap);
                        return;
                    }

                    // Make sure coins were locked for the swap with status "swap.expired"
                    await getSubmarineTransaction(swap.asset, swap.id);
                    addToRefundableSwaps(swap);
                }
            });
    });

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame">
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
                        accept="application/json,image/png"
                        onChange={(e) => uploadChange(e)}
                    />
                    <hr />
                    <Show when={refundTx() === ""}>
                        <RefundButton swap={refundJson} />
                        <RefundEta />
                    </Show>
                    <Show when={refundTx() !== ""}>
                        <hr />
                        <p>{t("refunded")}</p>
                        <hr />
                        <BlockExplorer
                            typeLabel={"refund_tx"}
                            asset={refundJson().asset}
                            txId={refundTx()}
                        />
                    </Show>
                </div>
            </div>
        </Show>
    );
};

export default Refund;
