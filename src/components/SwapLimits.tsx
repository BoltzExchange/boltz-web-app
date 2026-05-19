import { Show } from "solid-js";

type SwapLimitProps = {
    label: string;
    testId: string;
    amount: number;
    loading: boolean;
    enabled?: boolean;
    onClick: (amount: number) => void;
};

type SwapLimitsProps = {
    minimum: number;
    maximum: number;
    minLabel: string;
    maxLabel: string;
    loading: boolean;
    maximumEnabled?: boolean;
    onSelectAmount: (amount: number) => void;
    onSelectMaximum?: () => void;
};

const SwapLimit = (props: SwapLimitProps) => (
    <button
        type="button"
        class="amount-limit-link"
        data-testid={props.testId}
        aria-busy={props.loading}
        aria-label={props.label}
        disabled={props.loading || !(props.enabled ?? props.amount > 0)}
        onClick={() => props.onClick(props.amount)}>
        <Show
            when={!props.loading}
            fallback={<span class="skeleton" aria-hidden="true" />}>
            {props.label}
        </Show>
    </button>
);

const SwapLimits = (props: SwapLimitsProps) => (
    <Show
        when={
            props.loading ||
            props.minimum > 0 ||
            (props.maximumEnabled ?? props.maximum > 0)
        }>
        <div class="amount-limits">
            <SwapLimit
                label={props.minLabel}
                testId="limit-min-button"
                amount={props.minimum}
                loading={props.loading}
                onClick={() => props.onSelectAmount(props.minimum)}
            />
            <SwapLimit
                label={props.maxLabel}
                testId="limit-max-button"
                amount={props.maximum}
                loading={props.loading}
                enabled={props.maximumEnabled ?? props.maximum > 0}
                onClick={() => {
                    if (props.onSelectMaximum !== undefined) {
                        props.onSelectMaximum();
                        return;
                    }

                    props.onSelectAmount(props.maximum);
                }}
            />
        </div>
    </Show>
);

export default SwapLimits;
