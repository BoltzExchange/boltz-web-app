import { BigNumber } from "bignumber.js";
import { Match, Show, Switch, createEffect, createSignal } from "solid-js";

import { Currency } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { convertToFiat } from "../utils/fiat";

const FiatAmount = (props: {
    amount: number;
    variant: "label" | "text";
    for?: string;
}) => {
    const { showFiatAmount, t, btcPrice } = useGlobalContext();

    const [fiatAmount, setFiatAmount] = createSignal<BigNumber>(BigNumber(0));

    createEffect(() => {
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
