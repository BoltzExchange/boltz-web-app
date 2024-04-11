import { OutputType } from "boltz-core";
import { Accessor, Show } from "solid-js";

import DownloadRefund from "../components/DownloadRefund";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import NotFound from "../pages/NotFound";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const ShowTimeout = () => (
    <>
        <RefundEta />
        <DownloadRefund />
    </>
);

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
                <Show
                    when={swap().version === OutputType.Taproot}
                    fallback={<ShowTimeout />}>
                    <RefundButton
                        swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                    />
                </Show>
                <hr />
            </div>
        </Show>
    );
};

export default TransactionLockupFailed;
