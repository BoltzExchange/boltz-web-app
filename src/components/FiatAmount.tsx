import { BigNumber } from "bignumber.js";
import {
    type Accessor,
    Match,
    Show,
    Switch,
    createEffect,
    createSignal,
} from "solid-js";

import { USDT0, requireTokenConfig } from "../consts/Assets";
import { Currency } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { convertToFiat } from "../utils/fiat";

const FiatAmount = (props: {
    asset: Accessor<string>;
    amount: number;
    variant: "label" | "text";
    for?: string;
}) => {
    const { showFiatAmount, t, btcPrice } = useGlobalContext();

    const [fiatAmount, setFiatAmount] = createSignal<BigNumber>(BigNumber(0));

    createEffect(() => {
        if (props.asset() === USDT0) {
            setFiatAmount(
                BigNumber(props.amount).div(
                    BigNumber(10).pow(
                        requireTokenConfig(props.asset()).decimals,
                    ),
                ),
            );
            return;
        }

        if (btcPrice() instanceof BigNumber) {
            setFiatAmount(
                convertToFiat(BigNumber(props.amount), btcPrice() as BigNumber),
            );
        }
    });

    const renderFiatAmount = () => (
        <Switch>
            <Match when={btcPrice() instanceof BigNumber}>
                ≈ {fiatAmount().toFixed(2)} {Currency.USD}
            </Match>
            <Match when={btcPrice() === null}>
                <div class="skeleton" />
            </Match>
            <Match when={btcPrice() instanceof Error}>
                {t("fiat_rate_not_available")}
            </Match>
        </Switch>
    );

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
