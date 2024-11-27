import { useNavigate } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
import log from "loglevel";
import { Show, createEffect, createResource, createSignal } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { getSubmarinePreimage } from "../utils/boltzClient";
import { formatAmount } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { checkInvoicePreimage } from "../utils/invoice";
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

const paymentValidationUrl = (invoice: string, preimage: string): string => {
    const url = new URL(config.preimageValidation);
    url.searchParams.append("invoice", invoice);
    url.searchParams.append("preimage", preimage);
    return url.toString();
};

const TransactionClaimed = () => {
    const navigate = useNavigate();

    const { notify } = useGlobalContext();
    const { swap } = usePayContext();
    const { t, denomination, separator, setSwapStorage } = useGlobalContext();

    const [claimBroadcast, setClaimBroadcast] = createSignal<
        boolean | undefined
    >(undefined);

    const [preimage] = createResource(async () => {
        const submarine = swap() as SubmarineSwap;
        if (submarine?.type !== SwapType.Submarine) {
            return undefined;
        }

        if (submarine.preimage !== undefined) {
            return submarine.preimage;
        }

        const res = await getSubmarinePreimage(submarine.id);
        try {
            await checkInvoicePreimage(submarine.invoice, res.preimage);
        } catch (e) {
            log.error("Preimage check failed", e);
            notify("error", formatError(e));
        }

        submarine.preimage = res.preimage;
        await setSwapStorage(submarine);
        return res.preimage;
    });

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
                <span class="btn" onClick={() => navigate("/swap")}>
                    {t("new_swap")}
                </span>
                <Show when={!preimage.loading && preimage() !== undefined}>
                    <a
                        class="btn btn-explorer"
                        target="_blank"
                        href={paymentValidationUrl(
                            (swap() as SubmarineSwap).invoice,
                            preimage(),
                        )}>
                        {t("validate_payment")}
                    </a>
                </Show>
            </Show>
        </div>
    );
};

export default TransactionClaimed;
