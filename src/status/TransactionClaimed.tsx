import { useNavigate } from "@solidjs/router";
import { Show, createEffect, createSignal } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts";
import { useAppContext } from "../context/App";
import { useGlobalContext } from "../context/Global";
import { getReverseTransaction } from "../utils/boltzApi";
import { isBoltzClient } from "../utils/helper";
import { claim } from "../utils/lazy";

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
    const { t } = useGlobalContext();

    const [claimBroadcast, setClaimBroadcast] = createSignal(isBoltzClient());

    if (!isBoltzClient()) {
        const { swap, setSwap, swaps, setSwaps } = useAppContext();

        createEffect(() => {
            const s = swap();
            if (s) {
                // If it is a normal swap or a reverse one to RBTC we don't need to check for the claim transaction
                // Else make sure the transaction was actually broadcasted
                setClaimBroadcast(
                    !s.reverse || s.asset === RBTC || s.claimTx !== undefined,
                );
            }
        });

        createEffect(async () => {
            const toClaim = swap();

            if (toClaim && claimBroadcast() === false) {
                await claim.claim(
                    toClaim,
                    await getReverseTransaction(toClaim.asset, toClaim.id),
                );
                const allSwaps = swaps();
                allSwaps.find((swap) => swap.id === toClaim.id).claimTx =
                    toClaim.claimTx;
                setSwaps(allSwaps);
                setSwap(toClaim);
            }
        });
    }

    return (
        <div>
            <Show when={claimBroadcast() === true} fallback={<Broadcasting />}>
                <h2>{t("congrats")}</h2>
                <p>{t("successfully_swapped")}</p>
                <hr />
                <span class="btn" onClick={() => navigate("/swap")}>
                    {t("new_swap")}
                </span>
            </Show>
        </div>
    );
};

export default TransactionClaimed;
