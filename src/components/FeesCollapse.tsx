import { BigNumber } from "bignumber.js";
import { formatEther, formatUnits } from "ethers";
import log from "loglevel";
import { VsChevronRight } from "solid-icons/vs";
import {
    Show,
    createMemo,
    createResource,
    createSignal,
    onMount,
} from "solid-js";

import { config } from "../config";
import {
    BTC,
    getAssetDisplaySymbol,
    requireTokenConfig,
} from "../consts/Assets";
import { Currency } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { formatAmount, formatDenomination } from "../utils/denomination";
import {
    convertToFiat,
    getGasTokenPriceFailover,
    hasGasTokenPriceLookup,
} from "../utils/fiat";
import { getPair } from "../utils/helper";
import AmountDenominator from "./AmountDenominator";
import { RoutingFee, getFeeHighlightClass } from "./Fees";

const enum FeeUsdViewStatus {
    Loading = "loading",
    Error = "error",
    Ok = "ok",
}

type FeeUsdView =
    | { status: FeeUsdViewStatus.Loading }
    | { status: FeeUsdViewStatus.Error }
    | { status: FeeUsdViewStatus.Ok; amount: BigNumber };

const TokenFee = (props: { token?: string }) => {
    return (
        <Show when={props.token}>
            {(token) => (
                <AmountDenominator value={getAssetDisplaySymbol(token())} />
            )}
        </Show>
    );
};

const FeesCollapse = () => {
    const {
        btcPrice,
        fetchBtcPrice,
        t,
        denomination,
        separator,
        regularPairs,
    } = useGlobalContext();
    const { pair, receiveAmount, minerFee, sendAmount, boltzFee, getGasToken } =
        useCreateContext();

    const [feesExpanded, setFeesExpanded] = createSignal(false);

    const oftMessagingFeeIncluded = createMemo(() => {
        return pair().hasPostOft;
    });

    const hasOftMessagingFeeTokenUsdLookup = createMemo(() => {
        const token = pair().oftMessagingFeeToken;
        return token !== undefined && hasGasTokenPriceLookup(token);
    });

    const [oftMessagingFeeTokenUsdPrice] = createResource<
        BigNumber | Error | undefined,
        string
    >(
        () => {
            const token = pair().oftMessagingFeeToken;
            return token !== undefined && hasOftMessagingFeeTokenUsdLookup()
                ? token
                : undefined;
        },
        async (token) => {
            try {
                return await getGasTokenPriceFailover(token, Currency.USD);
            } catch (error) {
                log.warn("Failed to get gas token price", error);
                return error instanceof Error
                    ? error
                    : new Error("Failed to get gas token price");
            }
        },
    );

    const boltzFeeAmount = createMemo(() => {
        if (!pair().isRoutable) {
            return BigNumber(0);
        }

        receiveAmount();

        const boltzSwapSendAmount =
            pair().boltzSwapSendAmountFromLatestQuote(sendAmount());
        if (boltzSwapSendAmount === undefined) {
            return BigNumber(0);
        }

        return pair().feeOnSend(boltzSwapSendAmount);
    });

    const oftTransferFee = createMemo(() => {
        if (!pair().isRoutable) {
            return undefined;
        }

        receiveAmount();

        return pair().oftTransferFeeFromLatestQuote(sendAmount());
    });

    const oftMessagingFee = createMemo(() => {
        if (!pair().isRoutable) {
            return undefined;
        }

        receiveAmount();

        return pair().oftMessagingFeeFromLatestQuote(sendAmount());
    });

    const totalCollapsibleFeesUsdView = createMemo<FeeUsdView>(() => {
        receiveAmount();

        const rate = btcPrice();
        const totalSatsFee = BigNumber(minerFee()).plus(boltzFeeAmount());

        if (totalSatsFee.isGreaterThan(0)) {
            if (rate === null) {
                return { status: FeeUsdViewStatus.Loading };
            }

            if (rate instanceof Error) {
                return { status: FeeUsdViewStatus.Error };
            }
        }

        const btcFeesUsd =
            rate instanceof BigNumber && totalSatsFee.isGreaterThan(0)
                ? convertToFiat(totalSatsFee, rate)
                : BigNumber(0);

        let amount = btcFeesUsd;

        const transferFee = oftTransferFee();
        const transferFeeAsset = pair().oftTransferFeeAsset;
        if (
            transferFee !== undefined &&
            !transferFee.isNaN() &&
            transferFeeAsset !== undefined
        ) {
            const { decimals } = requireTokenConfig(transferFeeAsset);
            amount = amount.plus(transferFee.div(BigNumber(10).pow(decimals)));
        }

        const messagingFee = oftMessagingFee();
        const messagingFeeTokenUsdRate = oftMessagingFeeTokenUsdPrice();

        if (oftMessagingFeeIncluded() && messagingFee !== undefined) {
            if (messagingFeeTokenUsdRate === undefined) {
                if (!hasOftMessagingFeeTokenUsdLookup()) {
                    return { status: FeeUsdViewStatus.Error };
                }

                return { status: FeeUsdViewStatus.Loading };
            }

            if (messagingFeeTokenUsdRate instanceof Error) {
                return { status: FeeUsdViewStatus.Error };
            }

            amount = amount.plus(
                BigNumber(formatEther(messagingFee)).multipliedBy(
                    messagingFeeTokenUsdRate,
                ),
            );
        }

        return {
            status: FeeUsdViewStatus.Ok,
            amount,
        };
    });

    const renderTotalCollapsibleFeesUsdView = () => {
        const view = totalCollapsibleFeesUsdView();

        switch (view.status) {
            case FeeUsdViewStatus.Ok:
                return (
                    <>
                        ≈{" "}
                        <span data-testid="fees-total-amount">
                            {view.amount.toFixed(2)}
                        </span>{" "}
                        {Currency.USD}
                    </>
                );

            case FeeUsdViewStatus.Loading:
                return <span class="skeleton" />;

            case FeeUsdViewStatus.Error:
                return t("fiat_rate_not_available");

            default: {
                const exhaustiveCheck: never = view;
                return exhaustiveCheck;
            }
        }
    };

    const formattedOftMessagingFee = createMemo(() => {
        const fee = oftMessagingFee();
        if (fee === undefined) {
            return undefined;
        }

        return BigNumber(
            formatUnits(
                fee,
                config.assets[pair().fromAsset]?.network?.nativeCurrency
                    ?.decimals ?? 18,
            ),
        )
            .toFixed(6)
            .replace(/\.?0+$/, "");
    });

    onMount(() => {
        void fetchBtcPrice();
    });

    return (
        <>
            <button
                type="button"
                class="fees-toggle"
                data-testid="fees-toggle"
                aria-expanded={feesExpanded()}
                onClick={() => setFeesExpanded(!feesExpanded())}>
                <span class="fees-toggle-icon">
                    <VsChevronRight />
                </span>
                {t("swap_fees")}: {renderTotalCollapsibleFeesUsdView()}
            </button>
            <div
                class="fees-details-shell"
                classList={{ "is-expanded": feesExpanded() }}
                aria-hidden={!feesExpanded()}
                inert={!feesExpanded() || undefined}>
                <div class="fees-details-inner">
                    <label class="fees-details">
                        {t("network_fee")}:{" "}
                        <span class="fee-amount">
                            <span class="network-fee" data-testid="network-fee">
                                {formatAmount(
                                    BigNumber(minerFee()),
                                    denomination(),
                                    separator(),
                                    BTC,
                                    true,
                                )}
                            </span>
                            <AmountDenominator value={denomination()} />
                        </span>
                        <br />
                        {t("fee")} (
                        <span
                            class={
                                config.isPro &&
                                getFeeHighlightClass(
                                    boltzFee(),
                                    getPair(
                                        regularPairs(),
                                        pair().swapToCreate?.type,
                                        pair().fromAsset,
                                        pair().toAsset,
                                    )?.fees.percentage,
                                )
                            }>
                            {boltzFee().toString().replaceAll(".", separator())}
                            %
                        </span>
                        ):{" "}
                        <span class="fee-amount">
                            <span class="boltz-fee" data-testid="boltz-fee">
                                {formatAmount(
                                    boltzFeeAmount(),
                                    denomination(),
                                    separator(),
                                    BTC,
                                    true,
                                )}
                            </span>
                            <AmountDenominator value={denomination()} />
                        </span>
                        <Show
                            when={
                                oftTransferFee() !== undefined &&
                                oftTransferFee()!.isGreaterThan(0) &&
                                pair().oftTransferFeeAsset !== undefined
                            }>
                            <br />
                            {t("legacy_mesh_fee_label")}:{" "}
                            <span class="fee-amount">
                                <span data-testid="legacy-mesh-fee">
                                    {formatAmount(
                                        oftTransferFee()!,
                                        denomination(),
                                        separator(),
                                        pair().oftTransferFeeAsset!,
                                        true,
                                    )}
                                </span>
                                <AmountDenominator
                                    value={formatDenomination(
                                        denomination(),
                                        pair().oftTransferFeeAsset!,
                                    )}
                                />
                            </span>
                        </Show>
                        <Show
                            when={
                                oftMessagingFeeIncluded() &&
                                formattedOftMessagingFee() !== undefined
                            }>
                            <br />
                            {t("oft_messaging_fee_label")}:{" "}
                            <span class="fee-amount">
                                <span
                                    class="oft-messaging-fee"
                                    data-testid="oft-messaging-fee">
                                    {formattedOftMessagingFee()}
                                </span>
                                <TokenFee token={pair().oftMessagingFeeToken} />
                            </span>
                        </Show>
                        <Show when={getGasToken()}>
                            <br />
                            {t("gas_topup_label", {
                                gasToken:
                                    config.assets?.[pair().toAsset]?.network
                                        ?.gasToken ?? "",
                            })}
                        </Show>
                    </label>
                </div>
            </div>
            <RoutingFee />
            <Show
                when={
                    !oftMessagingFeeIncluded() &&
                    formattedOftMessagingFee() !== undefined
                }>
                <span class="fees-extra-line">
                    {t("oft_messaging_fee_label")}:{" "}
                    <span class="fee-amount">
                        <span
                            class="oft-messaging-fee"
                            data-testid="oft-messaging-fee">
                            {formattedOftMessagingFee()}
                        </span>
                        <TokenFee token={pair().oftMessagingFeeToken} />
                    </span>
                </span>
            </Show>
        </>
    );
};

export default FeesCollapse;
