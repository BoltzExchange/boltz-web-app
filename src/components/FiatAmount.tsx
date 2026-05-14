import { BigNumber } from "bignumber.js";
import {
    type Accessor,
    Match,
    Show,
    Switch,
    createEffect,
    createSignal,
} from "solid-js";

import { isStablecoinAsset, requireTokenConfig } from "../consts/Assets";
import { useFiatContext } from "../context/Fiat";
import { useGlobalContext } from "../context/Global";
import { convertToFiat } from "../utils/fiat";

const FiatAmount = (props: {
    asset: Accessor<string>;
    amount: number;
    variant: "label" | "text";
    for?: string;
    loading?: Accessor<boolean>;
}) => {
    const { t } = useGlobalContext();
    const { showFiatAmount, btcPrice, fiatCurrency, usdToFiatRate } =
        useFiatContext();

    const [fiatAmount, setFiatAmount] = createSignal<BigNumber>(BigNumber(0));

    createEffect(() => {
        if (isStablecoinAsset(props.asset())) {
            const faceValueUsd = BigNumber(props.amount).div(
                BigNumber(10).pow(requireTokenConfig(props.asset()).decimals),
            );
            const rate = usdToFiatRate();
            if (rate instanceof BigNumber) {
                setFiatAmount(faceValueUsd.multipliedBy(rate));
            }
            return;
        }

        if (btcPrice() instanceof BigNumber) {
            setFiatAmount(
                convertToFiat(BigNumber(props.amount), btcPrice() as BigNumber),
            );
        }
    });

    const renderFiatAmount = () => {
        if (props.loading?.()) {
            return null;
        }

        if (isStablecoinAsset(props.asset())) {
            if (usdToFiatRate() instanceof BigNumber) {
                return (
                    <>
                        ≈ {fiatAmount().toFixed(2)} {fiatCurrency()}
                    </>
                );
            }
            return btcPrice() === null ? (
                <div class="skeleton" />
            ) : (
                t("fiat_rate_not_available")
            );
        }

        return (
            <Switch>
                <Match when={btcPrice() instanceof BigNumber}>
                    ≈ {fiatAmount().toFixed(2)} {fiatCurrency()}
                </Match>
                <Match when={btcPrice() === null}>
                    <div class="skeleton" />
                </Match>
                <Match when={btcPrice() instanceof Error}>
                    {t("fiat_rate_not_available")}
                </Match>
            </Switch>
        );
    };

    return (
        <Show when={showFiatAmount()}>
            <Switch>
                <Match when={props.variant === "label"}>
                    <label for={props.for} class="input-label">
                        {renderFiatAmount()}
                    </label>
                </Match>
                <Match when={props.variant === "text"}>
                    <p class="text-muted">{renderFiatAmount()}</p>
                </Match>
            </Switch>
        </Show>
    );
};

export default FiatAmount;
