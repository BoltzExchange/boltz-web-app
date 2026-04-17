import { BigNumber } from "bignumber.js";
import { formatUnits } from "ethers";
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
import { BridgeMessagingFeeDisplayMode } from "../utils/Pair";
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

const getBridgeMessagingFeeTokenDecimals = (
    token: string | undefined,
): number => {
    if (token === undefined) {
        return 18;
    }

    const assets = config.assets;
    const directAssetConfig = assets?.[token];
    const directDecimals =
        directAssetConfig?.token?.decimals ??
        directAssetConfig?.network?.nativeCurrency?.decimals;
    if (directDecimals !== undefined) {
        return directDecimals;
    }

    if (assets === undefined) {
        return 18;
    }

    return (
        Object.values(assets).find(
            (assetConfig) => assetConfig.network?.gasToken === token,
        )?.network?.nativeCurrency?.decimals ?? 18
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

    const bridgeMessagingFeeIncluded = createMemo(() => {
        return (
            pair().bridgeMessagingFeeDisplayMode ===
            BridgeMessagingFeeDisplayMode.Details
        );
    });

    const hasBridgeMessagingFeeTokenUsdLookup = createMemo(() => {
        const token = pair().bridgeMessagingFeeToken;
        return token !== undefined && hasGasTokenPriceLookup(token);
    });

    const [bridgeMessagingFeeTokenUsdPrice] = createResource<
        BigNumber | Error | undefined,
        string
    >(
        () => {
            const token = pair().bridgeMessagingFeeToken;
            return token !== undefined && hasBridgeMessagingFeeTokenUsdLookup()
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

    const bridgeMessagingFeeTokenDecimals = createMemo(() =>
        getBridgeMessagingFeeTokenDecimals(pair().bridgeMessagingFeeToken),
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

    const bridgeTransferFee = createMemo(() => {
        if (!pair().isRoutable) {
            return undefined;
        }

        receiveAmount();

        return pair().bridgeTransferFeeFromLatestQuote(sendAmount());
    });

    const bridgeMessagingFee = createMemo(() => {
        if (!pair().isRoutable) {
            return undefined;
        }

        receiveAmount();

        return pair().bridgeMessagingFeeFromLatestQuote(sendAmount());
    });

    const hasBridgeMessagingFee = createMemo(() => {
        const fee = bridgeMessagingFee();
        return fee !== undefined && fee > 0n;
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

        const transferFee = bridgeTransferFee();
        const transferFeeAsset = pair().bridgeTransferFeeAsset;
        if (
            transferFee !== undefined &&
            !transferFee.isNaN() &&
            transferFeeAsset !== undefined
        ) {
            const { decimals } = requireTokenConfig(transferFeeAsset);
            amount = amount.plus(transferFee.div(BigNumber(10).pow(decimals)));
        }

        const messagingFee = bridgeMessagingFee();
        const messagingFeeTokenUsdRate = bridgeMessagingFeeTokenUsdPrice();

        if (bridgeMessagingFeeIncluded() && hasBridgeMessagingFee()) {
            if (messagingFeeTokenUsdRate === undefined) {
                if (!hasBridgeMessagingFeeTokenUsdLookup()) {
                    return { status: FeeUsdViewStatus.Error };
                }

                return { status: FeeUsdViewStatus.Loading };
            }

            if (messagingFeeTokenUsdRate instanceof Error) {
                return { status: FeeUsdViewStatus.Error };
            }

            amount = amount.plus(
                BigNumber(
                    formatUnits(
                        messagingFee,
                        bridgeMessagingFeeTokenDecimals(),
                    ),
                ).multipliedBy(messagingFeeTokenUsdRate),
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
                    <span class="fees-toggle-value">
                        ≈&nbsp;
                        <span data-testid="fees-total-amount">
                            {view.amount.toFixed(2)}
                        </span>
                        &nbsp;{Currency.USD}
                    </span>
                );

            case FeeUsdViewStatus.Loading:
                return (
                    <span class="fees-toggle-value">
                        <span class="skeleton" />
                    </span>
                );

            case FeeUsdViewStatus.Error:
                return (
                    <span class="fees-toggle-value">
                        {t("fiat_rate_not_available")}
                    </span>
                );

            default: {
                const exhaustiveCheck: never = view;
                return exhaustiveCheck;
            }
        }
    };

    const formattedBridgeMessagingFee = createMemo(() => {
        const fee = bridgeMessagingFee();
        if (fee === undefined || fee <= 0n) {
            return undefined;
        }

        return BigNumber(formatUnits(fee, bridgeMessagingFeeTokenDecimals()))
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
                <span class="fees-toggle-label">
                    <span class="fees-toggle-icon">
                        <VsChevronRight />
                    </span>
                    {t("swap_fees")}:
                </span>
                {renderTotalCollapsibleFeesUsdView()}
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
                                bridgeTransferFee() !== undefined &&
                                bridgeTransferFee()!.isGreaterThan(0) &&
                                pair().bridgeTransferFeeAsset !== undefined
                            }>
                            <br />
                            {t("bridge_transfer_fee")}:{" "}
                            <span class="fee-amount">
                                <span data-testid="bridge-transfer-fee">
                                    {formatAmount(
                                        bridgeTransferFee()!,
                                        denomination(),
                                        separator(),
                                        pair().bridgeTransferFeeAsset!,
                                        true,
                                    )}
                                </span>
                                <AmountDenominator
                                    value={formatDenomination(
                                        denomination(),
                                        pair().bridgeTransferFeeAsset!,
                                    )}
                                />
                            </span>
                        </Show>
                        <Show
                            when={
                                pair().bridgeMessagingFeeDisplayMode ===
                                    BridgeMessagingFeeDisplayMode.Details &&
                                hasBridgeMessagingFee() &&
                                formattedBridgeMessagingFee() !== undefined
                            }>
                            <br />
                            {t("bridge_messaging_fee")}:{" "}
                            <span class="fee-amount">
                                <span
                                    class="bridge-messaging-fee"
                                    data-testid="bridge-messaging-fee">
                                    {formattedBridgeMessagingFee()}
                                </span>
                                <TokenFee
                                    token={pair().bridgeMessagingFeeToken}
                                />
                            </span>
                        </Show>
                        <Show
                            when={
                                getGasToken() &&
                                config.assets?.[pair().toAsset]?.network
                                    ?.gasToken
                            }>
                            <br />
                            {t("gas_topup_label", {
                                gasToken:
                                    config.assets?.[pair().toAsset]?.network
                                        ?.gasToken,
                            })}
                        </Show>
                    </label>
                </div>
            </div>
            <RoutingFee />
            <Show
                when={
                    pair().bridgeMessagingFeeDisplayMode ===
                        BridgeMessagingFeeDisplayMode.Inline &&
                    hasBridgeMessagingFee() &&
                    formattedBridgeMessagingFee() !== undefined
                }>
                <span class="fees-extra-line">
                    {t("bridge_messaging_fee")}:{" "}
                    <span class="fee-amount">
                        <span
                            class="bridge-messaging-fee"
                            data-testid="bridge-messaging-fee">
                            {formattedBridgeMessagingFee()}
                        </span>
                        <TokenFee token={pair().bridgeMessagingFeeToken} />
                    </span>
                </span>
            </Show>
        </>
    );
};

export default FeesCollapse;
