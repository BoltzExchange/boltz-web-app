import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Accessor, Show, createResource } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { getLockupTransaction } from "../utils/boltzClient";
import { formatError } from "../utils/errors";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const SwapExpired = () => {
    const navigate = useNavigate();
    const { failureReason, swap } = usePayContext();
    const { t, setTransactionToRefund, transactionToRefund } =
        useGlobalContext();

    createResource(async () => {
        setTransactionToRefund(null);
        try {
            const res = await getLockupTransaction(swap().id, swap().type);
            log.debug(`got swap transaction for ${swap().id}`);
            setTransactionToRefund(res.hex);
        } catch (e) {
            log.warn(
                `no swap transaction for: ${swap().id}: ${formatError(e)}`,
            );
        }
    });

    return (
        <div>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={transactionToRefund() !== null}>
                <RefundButton
                    swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                />
                <hr />
            </Show>
            <button class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </button>
        </div>
    );
};

export default SwapExpired;
