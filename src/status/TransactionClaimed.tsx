import { useNavigate } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
import { Show, createEffect, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { formatAmount } from "../utils/denomination";
import { SubmarineSwap } from "../utils/swapCreator";

const Broadcasting = () => {
    const { t } = useGlobalContext();
    return (
        <div>
            <h2>{t("broadcasting_claim")}</h2>
            <LoadingSpinner />
        </div>
    );
};

const TransactionClaimed = () => {
    const navigate = useNavigate();
    const { swap } = usePayContext();
    const { t, denomination, separator } = useGlobalContext();

    const [claimBroadcast, setClaimBroadcast] = createSignal<
        boolean | undefined
    >(undefined);

    createEffect(() => {
        const s = swap();
        if (s === undefined || s === null) {
            return;
        }

        // If it is a normal swap or a reverse one to RBTC we don't need to check for the claim transaction
        // Else make sure the transaction was actually broadcast
        setClaimBroadcast(
            s.type !== SwapType.Reverse ||
                s.assetReceive === RBTC ||
                s.claimTx !== undefined,
        );
    });

    return (
        <div>
            <Show when={claimBroadcast() === true} fallback={<Broadcasting />}>
                <h2>{t("congrats")}</h2>
                <p>
                    {t("successfully_swapped", {
                        amount: formatAmount(
                            BigNumber(swap().receiveAmount),
                            denomination(),
                            separator(),
                        ),
                        denomination: denomination(),
                    })}
                </p>
                <hr />
                <BlockExplorer
                    asset={
                        swap().claimTx ? swap().assetReceive : swap().assetSend
                    }
                    txId={swap().claimTx || swap().lockupTx}
                    address={
                        swap().claimAddress || (swap() as SubmarineSwap).address
                    }
                />
                <span class="btn" onClick={() => navigate("/swap")}>
                    {t("new_swap")}
                </span>
            </Show>
        </div>
    );
};

export default TransactionClaimed;
