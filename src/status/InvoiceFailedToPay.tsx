import { OutputType } from "boltz-core";
import { Accessor, Show } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import DownloadRefund from "../components/DownloadRefund";
import RefundButton from "../components/RefundButton";
import { RBTC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { getLockupAddress } from "../utils/helper";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const InvoiceFailedToPay = () => {
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();
    const isTaproot = swap().version === OutputType.Taproot;

    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <RefundButton swap={swap as Accessor} />
            <Show when={swap().assetSend !== RBTC && !isTaproot}>
                <DownloadRefund />
            </Show>
            <hr />
            <BlockExplorer
                asset={swap()?.assetSend}
                address={getLockupAddress(swap() as SubmarineSwap | ChainSwap)}
            />
        </div>
    );
};

export default InvoiceFailedToPay;
