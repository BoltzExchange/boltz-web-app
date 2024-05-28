import { Accessor, Show } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import NotFound from "../pages/NotFound";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const TransactionLockupFailed = () => {
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <Show when={swap() !== null} fallback={<NotFound />}>
            <div>
                <h2>{t("lockup_failed")}</h2>
                <p>
                    {t("failure_reason")}: {failureReason()}
                </p>
                <hr />
                <RefundButton
                    swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                />
                <hr />
            </div>
        </Show>
    );
};

export default TransactionLockupFailed;
