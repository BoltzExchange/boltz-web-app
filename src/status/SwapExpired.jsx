import log from "loglevel";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { Show, createEffect, createSignal } from "solid-js";
import fetcher, { refund, refundAddressChange } from "../helper";

import {
    swap,
    failureReason,
    transactionToRefund,
    setTransactionToRefund,
} from "../signals";

const SwapExpired = () => {
    const [t] = useI18n();

    const [valid, setValid] = createSignal(false);

    createEffect(() => {
        setTransactionToRefund(null);
        fetcher(
            "/getswaptransaction",
            (res) => {
                log.debug(`got swap transaction for ${swap().id}`);
                setTransactionToRefund(res);
            },
            {
                id: swap().id,
            },
            () => {
                log.warn(`no swap transaction for: ${swap().id}`);
            }
        );
    });

    const navigate = useNavigate();

    return (
        <div>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={transactionToRefund() !== null}>
                <input
                    onInput={(e) =>
                        setValid(refundAddressChange(e, swap().asset))
                    }
                    type="text"
                    id="refundAddress"
                    name="refundAddress"
                    placeholder={t("refund_address_placeholder")}
                />
                <button
                    class="btn"
                    disabled={valid() ? "" : "disabled"}
                    onclick={() => refund(swap())}>
                    {t("refund")}
                </button>
                <hr />
            </Show>
            <button class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </button>
        </div>
    );
};

export default SwapExpired;
