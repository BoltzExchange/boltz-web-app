import { BigNumber } from "bignumber.js";
import {
    Match,
    Show,
    Switch,
    createEffect,
    createResource,
    createSignal,
} from "solid-js";

import { Currency } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { convertToFiat, getBtcPriceFailover } from "../utils/fiat";

const FiatAmount = (props: {
    amount: number;
    variant: "label" | "text";
    for?: string;
}) => {
    const { showFiatAmount, t } = useGlobalContext();

    const [fiatAmount, setFiatAmount] = createSignal<BigNumber>(BigNumber(0));

    const [btcPrice] = createResource(async () => {
        if (!showFiatAmount()) return null;
        return await getBtcPriceFailover();
    });

    createEffect(() => {
        if (btcPrice.state === "ready") {
            setFiatAmount(convertToFiat(BigNumber(props.amount), btcPrice()));
        }
    });

    const renderFiatAmount = () => (
        <Switch>
            <Match when={showFiatAmount() && btcPrice.state === "ready"}>
                ≈ {fiatAmount().toFixed(2)} {Currency.USD}
            </Match>
            <Match when={showFiatAmount() && btcPrice.state === "pending"}>
                <div class="skeleton" />
            </Match>
            <Match when={showFiatAmount() && btcPrice.state === "errored"}>
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
