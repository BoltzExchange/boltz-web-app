import { useI18n } from "@solid-primitives/i18n";
import { createSignal, createEffect } from "solid-js";
import { fetcher, refund } from "./helper";
import {
    refundTx,
    refundAddress,
    upload,
    setUpload,
    setTimeoutEta,
    setTimeoutBlockheight,
    setTransactionToRefund,
    refundAddressChange,
} from "./signals";
import RefundEta from "./components/RefundEta";
import BlockExplorer from "./components/BlockExplorer";

const Refund = () => {
    const [t] = useI18n();

    const [refundable, setRefundable] = createSignal(true);
    const [error, setError] = createSignal("no file seleced");
    const [refundJson, setRefundJson] = createSignal(null);

    createEffect(() => {
        new Response(upload()).json().then(
            (json) => {
                if (json === 0) return;
                setRefundJson(json);
            },
            () => {
                setRefundJson(null);
                setError("not a json file");
            }
        );
    });

    createEffect(() => {
        if (refundAddress() === null) return setError("no refund address");
        if (refundJson() === null) return setError("no json file");
        setError(false);
    });

    const startRefund = () => {
        const refundInfo = refundJson();
        fetcher(
            "/getswaptransaction",
            async (data) => {
                if (data.timeoutEta) {
                    setError(t("swap_not_refundable_yet"));
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
                    onKeyUp={refundAddressChange}
                    onChange={refundAddressChange}
                    type="text"
                    id="refundAddress"
                    name="refundAddress"
                    placeholder={t("refund_address_placeholder")}
                />
                <input
                    type="file"
                    id="refundUpload"
                    onChange={(e) => setUpload(e.currentTarget.files[0])}
                />
                <div class={error() === false ? "hidden" : ""}>
                    <span class="error">{error()}</span>
                </div>
                <div class={error() !== false ? "hidden" : ""}>
                    <span class="btn btn-success" onClick={startRefund}>
                        {t("refund")}
                    </span>
                </div>
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
