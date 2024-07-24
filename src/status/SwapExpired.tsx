import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Accessor, Show, createEffect, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { LockupTransaction, getLockupTransaction } from "../utils/boltzClient";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const SwapExpired = () => {
    const navigate = useNavigate();
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();

    const [transactionToRefund, setTransactionToRefund] =
        createSignal<LockupTransaction>(null);

    createEffect(async () => {
        setTransactionToRefund(null);
        try {
            const res = await getLockupTransaction(
                swap().assetSend,
                swap().id,
                swap().type,
            );
            log.debug(`got swap transaction for ${swap().id}`);
            setTransactionToRefund(res);
        } catch (error: any) {
            log.warn(`no swap transaction for: ${swap().id}`, error);
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
                <BlockExplorer
                    asset={swap().assetSend}
                    txId={transactionToRefund().id}
                />
            </Show>
            <button class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </button>
        </div>
    );
};

export default SwapExpired;
