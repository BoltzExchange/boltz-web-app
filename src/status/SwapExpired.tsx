import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createEffect } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useSwapContext } from "../context/Swap";
import { getSubmarineTransaction } from "../utils/boltzClient";
import { isBoltzClient } from "../utils/helper";

const Refund = () => {
    const { swap } = useSwapContext();
    const { setTransactionToRefund, transactionToRefund } = useGlobalContext();

    createEffect(async () => {
        if (!isBoltzClient) {
            setTransactionToRefund(null);
            try {
                const res = await getSubmarineTransaction(
                    swap().asset,
                    swap().id,
                );
                log.debug(`got swap transaction for ${swap().id}`);
                setTransactionToRefund(res.hex);
            } catch (error: any) {
                log.warn(`no swap transaction for: ${swap().id}`, error);
            }
        }
    });

    return (
        <Show when={transactionToRefund() !== null}>
            <RefundButton swap={swap} />
            <hr />
        </Show>
    );
};

const SwapExpired = () => {
    const navigate = useNavigate();
    const { failureReason } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <div>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={!isBoltzClient}>
                <Refund />
            </Show>
            <button class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </button>
        </div>
    );
};

export default SwapExpired;
