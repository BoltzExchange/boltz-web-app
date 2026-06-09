import BigNumber from "bignumber.js";
import { ImArrowDown } from "solid-icons/im";
import { For, Show } from "solid-js";

import { useGlobalContext } from "../context/Global";
import type { DictKey } from "../i18n/i18n";
import {
    formatAmount,
    formatDenomination,
    getDecimals,
} from "../utils/denomination";

type SummaryAmount = number | string | bigint | BigNumber;

export type SwapAmountSummaryItem = {
    amount: SummaryAmount;
    asset: string;
    label: DictKey;
    testId?: string;
};

const SummaryItem = (props: SwapAmountSummaryItem) => {
    const { t, denomination, separator } = useGlobalContext();
    const isErc20 = () => getDecimals(props.asset).isErc20;
    const amount = () => new BigNumber(props.amount.toString());

    return (
        <div>
            <div>{t(props.label)}</div>
            <span data-testid={props.testId}>
                {formatAmount(
                    amount(),
                    denomination(),
                    separator(),
                    props.asset,
                ) || 0}
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

const SwapAmountSummary = (props: {
    class?: string;
    items: SwapAmountSummaryItem[];
}) => (
    <div class={`quote${props.class ? ` ${props.class}` : ""}`}>
        <For each={props.items}>
            {(item, index) => (
                <>
                    <SummaryItem {...item} />
                    <Show when={index() < props.items.length - 1}>
                        <ImArrowDown size={15} style={{ opacity: 0.5 }} />
                    </Show>
                </>
            )}
        </For>
    </div>
);

export default SwapAmountSummary;
