import { useI18n } from "@solid-primitives/i18n";
import { createSignal, createEffect } from "solid-js";
import { fetcher, refund } from "./helper";
import {
    refundTx,
    refundAddress,
    setRefundAddress,
    upload,
    setUpload,
    setTimeoutEta,
    setTimeoutBlockheight,
    setTransactionToRefund,
} from "./signals";
import { getAddress, getNetwork } from "./compat";
import RefundEta from "./components/RefundEta";
import BlockExplorer from "./components/BlockExplorer";


const Refund = () => {
    const [t] = useI18n();

    const [valid, setValid] = createSignal(false);
    const [addressValid, setAddressValid] = createSignal(false);
    const [refundable, setRefundable] = createSignal(true);
    const [refundJson, setRefundJson] = createSignal(null);

    createEffect(() => {
        new Response(upload()).json().then(
            (json) => {
                if (json === 0) return;
                setRefundJson(json);
            }
        );
    });

    createEffect(() => {
        if (addressValid() && refundJson()) {
            setValid(true);
        } else {
            setValid(false);
        }
    });

    const refundAddressChange = (e) => {
        const input= e.currentTarget;
        const inputValue = input.value;
        try {
            const asset_name = refundJson().asset;
            const address = getAddress(asset_name);
            address.toOutputScript(inputValue, getNetwork(asset_name));
            input.setCustomValidity("");
            setAddressValid(true);
            setRefundAddress(inputValue);
        } catch (e) {
            setAddressValid(false);
            input.setCustomValidity("invalid address");
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

    return (
        <div id="refund">
            <div class="frame">
                <h2>{t("refund_a_swap")}</h2>
                <p>{t("refund_a_swap_subline")}</p>
                <hr />
                <Show when={refundJson()}>
                    <input
                        required
                        onInput={refundAddressChange}
                        type="text"
                        id="refundAddress"
                        name="refundAddress"
                        placeholder={t("refund_address_placeholder")}
                    />
                </Show>
                <input
                    required
                    type="file"
                    id="refundUpload"
                    onInput={(e) => setUpload(e.currentTarget.files[0])}
                />
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
