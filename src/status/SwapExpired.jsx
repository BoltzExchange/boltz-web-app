import log from "loglevel";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { Show, createEffect } from "solid-js";
import fetcher, { refund } from "../helper";
import {
    swap,
    failureReason,
    setRefundAddress,
    transactionToRefund,
    setTransactionToRefund,
} from "../signals";

const SwapExpired = () => {
    const [t] = useI18n();

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
            },
        )
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
                    onKeyUp={(e) => setRefundAddress(e.currentTarget.value)}
                    onChange={(e) => setRefundAddress(e.currentTarget.value)}
                    type="text"
                    id="refundAddress"
                    name="refundAddress"
                    placeholder={t("refund_address_placeholder")}
                />
                <span class="btn" onclick={() => refund(swap())}>
                    {t("refund")}
                </span>
                <hr />
            </Show>
            <span class="btn" onClick={(e) => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default SwapExpired;
