import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createEffect } from "solid-js";

import RefundButton from "../components/RefundButton";
import { usePayContext } from "../context/Pay";
import t from "../i18n";
import { setTransactionToRefund, transactionToRefund } from "../signals";
import { fetcher } from "../utils/helper";

const SwapExpired = () => {
    const navigate = useNavigate();
    const { failureReason, swap } = usePayContext();

    createEffect(() => {
        setTransactionToRefund(null);
        fetcher(
            "/getswaptransaction",
            swap().asset,
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
                <RefundButton swap={swap} />
                <hr />
            </Show>
            <button class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </button>
        </div>
    );
};

export default SwapExpired;
