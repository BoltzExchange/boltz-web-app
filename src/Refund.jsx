import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createEffect, createSignal } from "solid-js";

import BlockExplorer from "./components/BlockExplorer";
import RefundEta from "./components/RefundEta";
import SwapList from "./components/SwapList";
import { fetcher, refund, refundAddressChange } from "./helper";
import t from "./i18n";
import {
    refundTx,
    setTimeoutBlockheight,
    setTimeoutEta,
    setTransactionToRefund,
    swaps,
} from "./signals";
import {
    swapStatusFailed,
    swapStatusSuccess,
    updateSwapStatus,
} from "./utils/swapStatus";

const refundJsonKeys = ["id", "asset", "privateKey", "redeemScript"];
const refundJsonKeysLiquid = refundJsonKeys.concat("blindingKey");

const Refund = () => {
    const navigate = useNavigate();

    const [valid, setValid] = createSignal(false);
    const [addressValid, setAddressValid] = createSignal(false);
    const [refundJsonValid, setRefundJsonValid] = createSignal(false);
    const [refundable, setRefundable] = createSignal(true);
    const [refundJson, setRefundJson] = createSignal(null);

    createEffect(() => {
        if (addressValid() && refundJsonValid()) {
            setValid(true);
        } else {
            setValid(false);
        }
    });

    const checkRefundJsonKeys = (input, json) => {
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

        setRefundJsonValid(valid);

        if (valid) {
            setRefundJson(json);
        } else {
            input.setCustomValidity(t("invalid_refund_file"));
        }
    };

    const uploadChange = (e) => {
        const input = e.currentTarget;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        setRefundJson("");
        setRefundJsonValid(false);

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

    const startRefund = () => {
        if (!valid()) return;
        const refundInfo = refundJson();
        fetcher(
            "/getswaptransaction",
            async (data) => {
                if (data.timeoutEta) {
                    setTimeoutEta(data.timeoutEta * 1000);
                    setTimeoutBlockheight(data.timeoutBlockHeight);
                    setRefundable(false);
                    return;
                }

                setRefundable(true);
                setTransactionToRefund(data);
                await refund(refundJson(), t);
            },
            {
                id: refundInfo.id,
            },
        );
    };

    const refundSwapsSanityFilter = (swap) =>
        !swap.reverse && swap.refundTx === undefined;

    const [refundableSwaps, setRefundableSwaps] = createSignal([]);

    const addToRefundableSwaps = (swap) => {
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
            .map((swap) => {
                fetcher(
                    "/swapstatus",
                    (status) => {
                        if (
                            !updateSwapStatus(swap.id, status.status) &&
                            Object.values(swapStatusFailed).includes(
                                status.status,
                            )
                        ) {
                            if (
                                status.status !== swapStatusFailed.SwapExpired
                            ) {
                                addToRefundableSwaps(swap);
                                return;
                            }

                            // Make sure coins were locked for the swap with status "swap.expired"
                            fetcher(
                                "/getswaptransaction",
                                () => {
                                    addToRefundableSwaps(swap);
                                },
                                { id: swap.id },
                                () => {},
                            );
                        }
                    },
                    { id: swap.id },
                    () => {},
                );
            });
    });

    return (
        <div id="refund">
            <div class="frame">
                <h2>{t("refund_a_swap")}</h2>
                <p>{t("refund_a_swap_subline")}</p>
                <hr />
                <SwapList swapsSignal={refundableSwaps} />
                <hr />
                <input
                    required
                    type="file"
                    id="refundUpload"
                    accept="application/json,image/png"
                    onChange={(e) => uploadChange(e)}
                />
                <input
                    required
                    disabled={!refundJsonValid()}
                    onInput={(e) =>
                        setAddressValid(
                            refundAddressChange(e, refundJson().asset),
                        )
                    }
                    type="text"
                    id="refundAddress"
                    name="refundAddress"
                    placeholder={t("refund_address_placeholder")}
                />
                <button
                    class="btn"
                    disabled={valid() && refundTx() === "" ? "" : "disabled"}
                    onClick={startRefund}>
                    {t("refund")}
                </button>
                <Show when={!refundable()}>
                    <hr />
                    <RefundEta />
                </Show>
                <Show when={refundTx() !== ""}>
                    <hr />
                    <p>{t("refunded")}</p>
                    <hr />
                    <BlockExplorer
                        asset={refundJson().asset}
                        txId={refundTx()}
                    />
                </Show>
            </div>
        </div>
    );
};

export default Refund;
