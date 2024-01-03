import { Show, createEffect, createSignal } from "solid-js";

import { decodeAddress } from "../compat";
import RefundEta from "../components/RefundEta";
import { fetcher, getApiUrl } from "../helper";
import t from "../i18n";
import { setRefundAddress } from "../signals";
import {
    refundAddress,
    setTimeoutBlockheight,
    setTimeoutEta,
    setTransactionToRefund,
} from "../signals";
import { refund } from "../utils/refund";

const RefundCreate = ({ swap, refundValid }) => {
    let inputRef: HTMLInputElement;

    const [valid, setValid] = createSignal(false);
    const [addressValid, setAddressValid] = createSignal(false);
    const [refundable, setRefundable] = createSignal(true);

    const validateAddress = (input: EventTarget & HTMLInputElement) => {
        const inputValue = input.value.trim();

        try {
            decodeAddress(swap().asset, inputValue);
            input.setCustomValidity("");
            input.classList.remove("invalid");
            setAddressValid(true);
            setRefundAddress(inputValue);
        } catch (e) {
            const msg = t("invalid_address", { asset: swap().asset });
            setAddressValid(false);
            input.classList.add("invalid");
            input.setCustomValidity(msg);
        }
    };

    const startRefund = () => {
        if (!valid()) return;
        fetcher(
            getApiUrl("/getswaptransaction", swap().asset),
            async (data) => {
                if (data.timeoutEta) {
                    setTimeoutEta(data.timeoutEta * 1000);
                    setTimeoutBlockheight(data.timeoutBlockHeight);
                    setRefundable(false);
                    return;
                }

                setRefundable(true);
                setTransactionToRefund(data);
                await refund(
                    swap(),
                    refundAddress(),
                    data.transactionHex,
                    data.timeoutBlockHeight,
                );
            },
            {
                id: swap().id,
            },
        );
    };

    createEffect(() => {
        if (addressValid() && refundValid()) {
            setValid(true);
        } else {
            setValid(false);
        }
    });

    return (
        <>
            <input
                ref={inputRef}
                required
                disabled={!refundValid()}
                onInput={(e) => validateAddress(e.currentTarget)}
                onKeyUp={(e) => validateAddress(e.currentTarget)}
                onPaste={(e) => validateAddress(e.currentTarget)}
                type="text"
                id="refundAddress"
                name="refundAddress"
                placeholder={t("refund_address_placeholder")}
            />
            <hr />
            <button
                class="btn"
                disabled={!(valid() && swap().refundTx === undefined)}
                onClick={startRefund}>
                {t("refund")}
            </button>
            <Show when={!refundable()}>
                <hr />
                <RefundEta />
            </Show>
        </>
    );
};

export default RefundCreate;
