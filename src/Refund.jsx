import { useI18n } from "@solid-primitives/i18n";
import { createSignal, createEffect } from "solid-js";
import { fetcher, refund, refundJsonKeys } from "./helper";
import {
    refundTx,
    setTimeoutEta,
    refundAddressChange,
    setTimeoutBlockheight,
    setTransactionToRefund,
} from "./signals";
import RefundEta from "./components/RefundEta";
import BlockExplorer from "./components/BlockExplorer";

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

    const uploadChange = (e) => {
        const input = e.currentTarget;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        setRefundJson("");
        setRefundJsonValid(false);
        new Response(inputFile)
            .json()
            .then((json) => {
                if (json === 0) return;
                let valid = true;
                refundJsonKeys.forEach((key) => {
                    if (!(key in json)) {
                        input.setCustomValidity("json: " + key + " is missing");
                        valid = false;
                        return;
                    }
                });
                if (valid) {
                    setRefundJson(json);
                    setRefundJsonValid(true);
                }
            })
            .catch(() => input.setCustomValidity("invalid json"));
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

    return (
        <div id="refund">
            <div class="frame">
                <h2>{t("refund_a_swap")}</h2>
                <p>{t("refund_a_swap_subline")}</p>
                <hr />
                <input
                    required
                    type="file"
                    id="refundUpload"
                    accept="application/json"
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
