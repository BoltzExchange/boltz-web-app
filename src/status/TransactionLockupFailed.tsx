import BigNumber from "bignumber.js";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";
import { ImArrowDown } from "solid-icons/im";
import {
    Accessor,
    Setter,
    Show,
    createEffect,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import RefundButton from "../components/RefundButton";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { DictKey } from "../i18n/i18n";
import NotFound from "../pages/NotFound";
import {
    acceptChainSwapNewQuote,
    getChainSwapNewQuote,
    getChainSwapTransactions,
} from "../utils/boltzClient";
import {
    getAddress,
    getNetwork,
    getOutputAmount,
    getTransaction,
} from "../utils/compat";
import { formatAmount } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { parseBlindingKey } from "../utils/helper";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const Amount = (props: { label: DictKey; amount: number }) => {
    const { t, denomination, separator } = useGlobalContext();

    return (
        <div>
            <div>{t(props.label)}</div>
            <input
                disabled
                type="text"
                placeholder="0"
                inputMode={denomination() == "btc" ? "decimal" : "numeric"}
                value={formatAmount(
                    new BigNumber(props.amount),
                    denomination(),
                    separator(),
                )}
            />
        </div>
    );
};

const TransactionLockupFailed = (props: {
    setStatusOverride: Setter<string | undefined>;
}) => {
    const { t, fetchPairs, setSwapStorage, pairs } = useGlobalContext();
    const { failureReason, swap, setSwap } = usePayContext();

    const [newQuote, newQuoteActions] = createResource<
        { sentAmount: number; quote: number; receiveAmount: number } | undefined
    >(async () => {
        if (swap() === null || swap().type !== SwapType.Chain) {
            return undefined;
        }

        const chainSwap = swap() as ChainSwap;

        try {
            const [quote, transactions] = await Promise.all([
                getChainSwapNewQuote(chainSwap.id),
                getChainSwapTransactions(chainSwap.id),
                fetchPairs(),
            ]);

            const claimFee =
                pairs()[SwapType.Chain][chainSwap.assetSend][
                    chainSwap.assetReceive
                ].fees.minerFees.user.claim + 1;

            const lockTransaction = getTransaction(chainSwap.assetSend).fromHex(
                transactions.userLock.transaction.hex,
            );
            const lockupScript = getAddress(chainSwap.assetSend).toOutputScript(
                chainSwap.lockupDetails.lockupAddress,
                getNetwork(chainSwap.assetSend) as LiquidNetwork,
            );

            const output = lockTransaction.outs.find((o) =>
                o.script.equals(lockupScript),
            );
            const outputAmount = await getOutputAmount(chainSwap.assetSend, {
                ...output,
                blindingPrivateKey: parseBlindingKey(chainSwap, true),
            } as never);

            props.setStatusOverride("quote.available");
            return {
                quote: quote.amount,
                sentAmount: outputAmount,
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

    createEffect(() => {
        if (quoteRejected()) {
            props.setStatusOverride(undefined);
        }
    });

    onCleanup(() => {
        props.setStatusOverride(undefined);
    });

    return (
        <Show when={swap() !== null} fallback={<NotFound />}>
            <Show
                when={newQuote.state === "ready"}
                fallback={<LoadingSpinner />}>
                <Show
                    when={newQuote() !== undefined && !quoteRejected()}
                    fallback={
                        <div>
                            <h2>{t("lockup_failed")}</h2>
                            <p>
                                {t("failure_reason")}: {failureReason()}
                            </p>
                            <hr />
                            <RefundButton
                                swap={
                                    swap as Accessor<SubmarineSwap | ChainSwap>
                                }
                            />
                            <hr />
                        </div>
                    }>
                    <div class="quote">
                        <Amount label={"sent"} amount={newQuote().sentAmount} />
                        <ImArrowDown size={15} style={{ opacity: 0.5 }} />
                        <Amount
                            label={"will_receive"}
                            amount={newQuote().receiveAmount}
                        />
                    </div>

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
                </Show>
            </Show>
        </Show>
    );
};

export default TransactionLockupFailed;
