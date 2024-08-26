import BigNumber from "bignumber.js";
import log from "loglevel";
import {
    Accessor,
    Match,
    Show,
    Switch,
    createResource,
    createSignal,
} from "solid-js";

import RefundButton from "../components/RefundButton";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import NotFound from "../pages/NotFound";
import {
    acceptChainSwapNewQuote,
    getChainSwapNewQuote,
} from "../utils/boltzClient";
import { formatAmount } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const TransactionLockupFailed = () => {
    const { t, denomination, separator, fetchPairs, setSwapStorage, pairs } =
        useGlobalContext();
    const { failureReason, swap, setSwap } = usePayContext();

    const [newQuote, newQuoteActions] = createResource<
        { quote: number; receiveAmount: number } | undefined
    >(async () => {
        if (swap() === null || swap().type !== SwapType.Chain) {
            return undefined;
        }

        try {
            const [quote] = await Promise.all([
                getChainSwapNewQuote(swap().id),
                fetchPairs(),
            ]);

            const claimFee =
                pairs()[SwapType.Chain][swap().assetSend][swap().assetReceive]
                    .fees.minerFees.user.claim + 1;

            return {
                quote: quote.amount,
                receiveAmount: quote.amount - claimFee,
            };
        } catch (e) {
            log.warn(
                `Getting new quote for swap ${swap().id} failed: ${formatError(e)}`,
            );
        }

        return undefined;
    });

    const [quoteRejected, setQuoteRejected] = createSignal<boolean>(false);

    return (
        <Show when={swap() !== null} fallback={<NotFound />}>
            <Switch
                fallback={
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
                }>
                <Match
                    when={
                        newQuote.state === "ready" &&
                        newQuote() !== undefined &&
                        !quoteRejected()
                    }>
                    <h2>
                        New quote:{" "}
                        {formatAmount(
                            BigNumber(newQuote().receiveAmount),
                            denomination(),
                            separator(),
                        )}
                    </h2>
                    <p>
                        {t("failure_reason")}: {failureReason()}
                    </p>
                    <div class="btns btns-space-between">
                        <button
                            class="btn btn-success"
                            onClick={async () => {
                                const newSwap = swap() as ChainSwap;

                                const { quote, receiveAmount } = newQuote();
                                newSwap.receiveAmount = receiveAmount;
                                newSwap.claimDetails.amount = quote;

                                await setSwapStorage(newSwap);
                                setSwap(newSwap);

                                try {
                                    await acceptChainSwapNewQuote(
                                        swap().id,
                                        newQuote().quote,
                                    );
                                } catch (e) {
                                    log.warn(
                                        `Accepting new quote failed: ${formatError(e)}`,
                                    );
                                    await newQuoteActions.refetch();
                                }
                            }}>
                            {t("accept")}
                        </button>
                        <button
                            class="btn btn-danger"
                            onClick={() => setQuoteRejected(true)}>
                            {t("refund")}
                        </button>
                    </div>
                    <hr />
                </Match>
            </Switch>
        </Show>
    );
};

export default TransactionLockupFailed;
