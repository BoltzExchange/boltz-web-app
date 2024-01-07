import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createEffect, createSignal } from "solid-js";

import t from "../i18n";
import {
    failureReason,
    setTransactionToRefund,
    swap,
    transactionToRefund,
} from "../signals";
import fetcher, { refund, refundAddressChange } from "../utils/helper";

const SwapExpired = () => {
    const navigate = useNavigate();

    const [valid, setValid] = createSignal(false);

    createEffect(() => {
        setTransactionToRefund(null);
        fetcher(
            "/getswaptransaction",
            (res: any) => {
                log.debug(`got swap transaction for ${swap().id}`);
                setTransactionToRefund(res);
            },
            {
                id: swap().id,
            },
            () => {
                log.warn(`no swap transaction for: ${swap().id}`);
            },
        );
    });

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
                    disabled={!valid()}
                    onclick={() => refund(swap(), t)}>
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
