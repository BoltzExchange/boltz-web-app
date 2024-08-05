import { Accessor, Show } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import NotFound from "../pages/NotFound";
import { getLockupAddress } from "../utils/helper";
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
                <BlockExplorer
                    asset={swap().assetSend}
                    address={getLockupAddress(
                        swap() as SubmarineSwap | ChainSwap,
                    )}
                />
            </div>
        </Show>
    );
};

export default TransactionLockupFailed;
