import BigNumber from "bignumber.js";
import log from "loglevel";
import { ImArrowDown } from "solid-icons/im";
import type { Accessor, Setter } from "solid-js";
import {
    Show,
    createEffect,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";
import { isRefundableSwapType } from "src/utils/rescue";

import LoadingSpinner from "../components/LoadingSpinner";
import RefundButton, { incorrectAssetError } from "../components/RefundButton";
import { isEvmAsset } from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { DictKey } from "../i18n/i18n";
import NotFound from "../pages/NotFound";
import Pair from "../utils/Pair";
import {
    acceptChainSwapNewQuote,
    getChainSwapNewQuote,
    getChainSwapTransactions,
} from "../utils/boltzClient";
import { calculateAmountOutMin } from "../utils/calculate";
import {
    decodeAddress,
    findOutputByScript,
    getOutputAmount,
    getTransaction,
} from "../utils/compat";
import {
    formatAmount,
    formatDenomination,
    getDecimals,
} from "../utils/denomination";
import { formatError } from "../utils/errors";
import { parseBlindingKey } from "../utils/helper";
import {
    type ChainSwap,
    type SubmarineSwap,
    getFinalAssetReceive,
    getFinalAssetSend,
} from "../utils/swapCreator";
import SwapRefunded from "./SwapRefunded";

const Amount = (props: { label: DictKey; amount: number; asset: string }) => {
    const { t, denomination, separator } = useGlobalContext();
    const isErc20 = () => getDecimals(props.asset).isErc20;

    return (
        <div>
            <div>{t(props.label)}</div>
            <span>
                {`${
                    formatAmount(
                        new BigNumber(props.amount),
                        denomination(),
                        separator(),
                        props.asset,
                    ) || 0
                }`}
                <Show
                    when={!isErc20()}
                    fallback={
                        <span class="asset-fallback">
                            {formatDenomination(denomination(), props.asset)}
                        </span>
                    }>
                    <span
                        class="denominator"
                        data-denominator={denomination()}
                    />
                </Show>
            </span>
        </div>
    );
};

const TransactionLockupFailed = (props: {
    setStatusOverride: Setter<string | undefined>;
}) => {
    const { t, fetchPairs, setSwapStorage, pairs, slippage } =
        useGlobalContext();
    const { failureReason, swap, setSwap, setFailureReason } = usePayContext();
    const [loading, setLoading] = createSignal(false);
    const [autoAcceptedQuote, setAutoAcceptedQuote] = createSignal<
        number | undefined
    >(undefined);

    const [newQuote, newQuoteActions] = createResource<
        { sentAmount: number; quote: number; receiveAmount: number } | undefined
    >(async () => {
        if (swap() === null || swap().type !== SwapType.Chain) {
            return undefined;
        }

        const chainSwap = swap() as ChainSwap;

        try {
            log.info(
                `Fetching replacement quote for chain swap ${chainSwap.id}`,
                {
                    assetSend: chainSwap.assetSend,
                    assetReceive: chainSwap.assetReceive,
                    finalAssetSend: getFinalAssetSend(chainSwap),
                    finalAssetReceive: getFinalAssetReceive(chainSwap),
                    dexPosition: chainSwap.dex?.position,
                    hasDex: chainSwap.dex !== undefined,
                    hasBridge: chainSwap.bridge !== undefined,
                },
            );
            const [quote, transactions] = await Promise.all([
                getChainSwapNewQuote(chainSwap.id),
                getChainSwapTransactions(chainSwap.id),
                fetchPairs(),
            ]);

            const currentPairs = pairs();
            if (currentPairs === undefined) {
                throw new Error("pairs are unavailable");
            }
            const claimFee =
                currentPairs[SwapType.Chain][chainSwap.assetSend][
                    chainSwap.assetReceive
                ].fees.minerFees.user.claim + 1;

            let sentAmountSource = "swap.sendAmount";
            const outputAmount =
                chainSwap.dex?.position === SwapPosition.Pre
                    ? ((sentAmountSource = "dex.quoteAmount"),
                      Number(chainSwap.dex.quoteAmount))
                    : !isEvmAsset(chainSwap.assetSend) &&
                        transactions.userLock.transaction.hex !== undefined
                      ? await (async () => {
                            sentAmountSource = "userLock.transaction.hex";
                            const lockTransaction = getTransaction(
                                chainSwap.assetSend,
                            ).fromHex(transactions.userLock.transaction.hex);
                            const { script: lockupScript } = decodeAddress(
                                chainSwap.assetSend,
                                chainSwap.lockupDetails.lockupAddress,
                            );

                            const output = findOutputByScript(
                                chainSwap.assetSend,
                                lockTransaction,
                                lockupScript,
                            );
                            return await getOutputAmount(chainSwap.assetSend, {
                                ...output,
                                blindingPrivateKey: parseBlindingKey(
                                    chainSwap,
                                    true,
                                ),
                            } as never);
                        })()
                      : chainSwap.sendAmount;
            const boltzReceiveAmount = BigNumber(quote.amount - claimFee);
            const routePair = new Pair(
                currentPairs,
                getFinalAssetSend(chainSwap),
                getFinalAssetReceive(chainSwap),
            );
            const receiveAmount = routePair.isRoutable
                ? await routePair.calculatePostBoltzReceiveAmount(
                      boltzReceiveAmount,
                      chainSwap.getGasToken,
                      chainSwap.originalDestination ||
                          chainSwap.signer ||
                          chainSwap.claimAddress,
                  )
                : boltzReceiveAmount;

            log.info(
                `Prepared replacement quote for chain swap ${chainSwap.id}`,
                {
                    rawQuoteAmount: quote.amount,
                    claimFee,
                    boltzReceiveAmount: boltzReceiveAmount.toFixed(),
                    finalReceiveAmount: receiveAmount.toFixed(),
                    sentAmount: outputAmount,
                    sentAmountSource,
                    routedQuote: routePair.isRoutable,
                },
            );

            props.setStatusOverride("quote.available");
            return {
                quote: quote.amount,
                sentAmount: outputAmount,
                receiveAmount: receiveAmount.toNumber(),
            };
        } catch (e) {
            log.warn(
                `Getting new quote for swap ${swap().id} failed: ${formatError(e)}`,
            );

            // We use that specific error to determine the refund type
            if (failureReason() !== incorrectAssetError) {
                setFailureReason(formatError(e));
            }
        }

        return undefined;
    });

    const [quoteRejected, setQuoteRejected] = createSignal<boolean>(false);

    const acceptQuote = async (
        currentSwap: ChainSwap,
        quoteData: { sentAmount: number; quote: number; receiveAmount: number },
    ) => {
        log.info(
            `Accepting replacement quote for chain swap ${currentSwap.id}`,
            {
                backendQuoteAmount: quoteData.quote,
                finalReceiveAmount: quoteData.receiveAmount,
                hasDex: currentSwap.dex !== undefined,
                hasBridge: currentSwap.bridge !== undefined,
            },
        );
        setLoading(true);
        currentSwap.receiveAmount = quoteData.receiveAmount;
        currentSwap.claimDetails.amount = quoteData.quote;
        if (currentSwap.dex !== undefined) {
            currentSwap.dex.quoteAmount =
                currentSwap.dex.position === SwapPosition.Pre
                    ? quoteData.sentAmount
                    : quoteData.receiveAmount;
        }

        await setSwapStorage(currentSwap);
        setSwap(currentSwap);

        try {
            await acceptChainSwapNewQuote(currentSwap.id, quoteData.quote);
            setAutoAcceptedQuote(quoteData.quote);
            log.info(
                `Accepted replacement quote for chain swap ${currentSwap.id}`,
            );
        } catch (e) {
            log.warn(`Accepting new quote failed: ${formatError(e)}`);
            await newQuoteActions.refetch();
        } finally {
            setLoading(false);
        }
    };

    createEffect(() => {
        const currentSwap = swap();
        const quoteData = newQuote();
        if (
            currentSwap === null ||
            currentSwap.type !== SwapType.Chain ||
            currentSwap.dex === undefined ||
            currentSwap.dex.position !== SwapPosition.Pre ||
            quoteData === undefined ||
            quoteRejected() ||
            loading() ||
            autoAcceptedQuote() === quoteData.quote
        ) {
            return;
        }

        const chainSwap = currentSwap as ChainSwap;

        const quoteThreshold = calculateAmountOutMin(
            BigInt(new BigNumber(chainSwap.receiveAmount).toFixed(0)),
            slippage(),
        );
        const quotedReceiveAmount = BigInt(
            new BigNumber(quoteData.receiveAmount).toFixed(0),
        );
        if (quotedReceiveAmount < quoteThreshold) {
            log.info(
                `Skipping auto-accept for chain swap ${chainSwap.id}: quote outside slippage`,
                {
                    quotedReceiveAmount: quotedReceiveAmount.toString(),
                    quoteThreshold: quoteThreshold.toString(),
                    slippage: slippage(),
                },
            );
            return;
        }

        log.info(
            `Auto-accepting replacement quote for chain swap ${chainSwap.id}`,
            {
                quotedReceiveAmount: quotedReceiveAmount.toString(),
                quoteThreshold: quoteThreshold.toString(),
                slippage: slippage(),
                backendQuoteAmount: quoteData.quote,
            },
        );
        void acceptQuote(chainSwap, quoteData);
    });

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
                        <>
                            <Show when={swap()?.refundTx === undefined}>
                                <h2>{t("lockup_failed")}</h2>
                                <p>
                                    {t("failure_reason")}: {failureReason()}
                                </p>
                                <hr />
                                <Show when={isRefundableSwapType(swap())}>
                                    <RefundButton
                                        swap={
                                            swap as Accessor<
                                                SubmarineSwap | ChainSwap
                                            >
                                        }
                                    />
                                    <hr />
                                </Show>
                            </Show>
                            <Show when={swap()?.refundTx !== undefined}>
                                <SwapRefunded refundTxId={swap().refundTx} />
                            </Show>
                        </>
                    }>
                    <div class="quote">
                        <Amount
                            label={"sent"}
                            amount={newQuote().sentAmount}
                            asset={
                                (swap() as ChainSwap).dex?.position ===
                                SwapPosition.Pre
                                    ? getFinalAssetSend(swap() as ChainSwap)
                                    : swap().assetSend
                            }
                        />
                        <ImArrowDown size={15} style={{ opacity: 0.5 }} />
                        <Amount
                            label={"will_receive"}
                            amount={newQuote().receiveAmount}
                            asset={getFinalAssetReceive(swap() as ChainSwap)}
                        />
                    </div>

                    <div class="btns btns-space-between">
                        <button
                            class="btn btn-success"
                            onClick={async () => {
                                const currentSwap = swap() as ChainSwap;
                                const quoteData = newQuote();
                                log.info(
                                    `Accepting new quote for swap ${currentSwap.id}`,
                                    quoteData,
                                );
                                await acceptQuote(currentSwap, quoteData);
                            }}
                            disabled={loading()}>
                            {loading() ? (
                                <LoadingSpinner class="inner-spinner" />
                            ) : (
                                t("accept")
                            )}
                        </button>
                        <button
                            class="btn btn-danger"
                            onClick={() => setQuoteRejected(true)}
                            disabled={loading()}>
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
