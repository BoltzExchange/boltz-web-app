import { OutputType } from "boltz-core";
import { Show } from "solid-js";

import DownloadRefund from "../components/DownloadRefund";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const ShowTimeout = () => (
    <>
        <RefundEta />
        <DownloadRefund />
    </>
);

const TransactionLockupFailed = () => {
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();
    const isTaproot = swap().version === OutputType.Taproot;

    return (
        <div>
            <h2>{t("lockup_failed")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={isTaproot} fallback={<ShowTimeout />}>
                <RefundButton swap={swap} />
            </Show>
            <hr />
        </div>
    );
};

export default TransactionLockupFailed;
