import { OutputType } from "boltz-core";
import { Show } from "solid-js";

import DownloadRefund from "../components/DownloadRefund";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useSwapContext } from "../context/Swap";
import { isBoltzClient } from "../utils/helper";

const ShowTimeout = () => (
    <>
        <RefundEta />
        <DownloadRefund />
    </>
);

const Refund = () => {
    const { swap } = useSwapContext();
    const isTaproot = swap().version === OutputType.Taproot;
    return (
        <Show when={isTaproot} fallback={<ShowTimeout />}>
            <RefundButton swap={swap} />
        </Show>
    );
};

const TransactionLockupFailed = () => {
    const { failureReason } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <div>
            <h2>{t("lockup_failed")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={!isBoltzClient} fallback={<RefundEta />}>
                <Refund />
            </Show>
            <hr />
        </div>
    );
};

export default TransactionLockupFailed;
