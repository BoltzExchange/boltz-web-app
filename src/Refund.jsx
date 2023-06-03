import log from "loglevel";
import QrScanner from "qr-scanner";
import { useI18n } from "@solid-primitives/i18n";
import { createSignal, createEffect } from "solid-js";
import SwapList from "./components/SwapList";
import RefundEta from "./components/RefundEta";
import BlockExplorer from "./components/BlockExplorer";
import { fetcher, refundAddressChange, refund } from "./helper";
import {
    swaps,
    refundTx,
    setTimeoutEta,
    setTimeoutBlockheight,
    setTransactionToRefund,
} from "./signals";
import {
    swapStatusFailed,
    swapStatusSuccess,
    updateSwapStatus,
} from "./utils/swapStatus";

const invalidFileError = "Invalid refund file";

const refundJsonKeys = ["id", "asset", "privateKey", "redeemScript"];
const refundJsonKeysLiquid = refundJsonKeys.concat("blindingKey");

const Refund = () => {
    const [t] = useI18n();

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

        const requiredKeys =
            json.asset !== "L-BTC" ? refundJsonKeys : refundJsonKeysLiquid;
        const valid = requiredKeys.every((key) => key in json);

        setRefundJsonValid(valid);

        if (valid) {
            setRefundJson(json);
        } else {
            input.setCustomValidity(invalidFileError);
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
                    checkRefundJsonKeys(input, JSON.parse(result.data))
                )
                .catch((e) => {
                    log.error("invalid QR code upload", e);
                    input.setCustomValidity(invalidFileError);
                });
        } else {
            new Response(inputFile)
                .json()
                .then((result) => checkRefundJsonKeys(input, result))
                .catch((e) => {
                    log.error("invalid file upload", e);
                    input.setCustomValidity(invalidFileError);
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

                setTransactionToRefund(data);
                await refund(refundJson());
            },
            {
                id: refundInfo.id,
            }
        );
    };

    const refundSwapsSanityFilter = (swap) => !swap.reverse &&
                swap.refundTx === undefined;

    const [refundableSwaps, setRefundableSwaps] = createSignal(undefined);

    createEffect(() => {
        const swapsToRefund = swaps().filter(refundSwapsSanityFilter).filter(
            (swap) =>
                Object.values(swapStatusFailed).includes(swap.status)
        );
        setRefundableSwaps(swapsToRefund);

        swaps()
            .filter(refundSwapsSanityFilter)
            .filter(
                (swap) =>
                    swap.status !== swapStatusSuccess.TransactionClaimed &&
                    swapsToRefund.find((found) => found.id === swap.id) ===
                        undefined
            )
            .map((swap) => {
                fetcher(
                    "/swapstatus",
                    (data) => {
                        if (
                            !updateSwapStatus(swap.id, data.status) &&
                            Object.values(swapStatusFailed).includes(
                                data.status
                            )
                        ) {
                            setRefundableSwaps(refundableSwaps().concat(swap));
                        }
                    },
                    { id: swap.id },
                    () => {}
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
                            refundAddressChange(e, refundJson().asset)
                        )
                    }
                    type="text"
                    id="refundAddress"
                    name="refundAddress"
                    placeholder={t("refund_address_placeholder")}
                />
                <hr />
                <button
                    class="btn"
                    disabled={valid() ? "" : "disabled"}
                    onClick={startRefund}>
                    {t("refund")}
                </button>
                <Show when={!refundable()}>
                    <RefundEta />
                </Show>
                <Show when={refundTx() !== ""}>
                    <hr />
                    <BlockExplorer
                        address={refundTx()}
                        asset={refundJson().asset}
                    />
                </Show>
            </div>
        </div>
    );
};

export default Refund;
