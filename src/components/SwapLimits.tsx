import { BigNumber } from "bignumber.js";

import { USDT0 } from "../consts/Assets";
import { type Denomination } from "../consts/Enums";
import { formatAmount } from "../utils/denomination";

type SwapLimitProps = {
    amount: number;
    asset: string;
    denomination: Denomination;
    label: string;
    onClick: () => void;
    separator: string;
    icon: Denomination | typeof USDT0;
};

type SwapLimitsProps = {
    asset: string;
    denomination: Denomination;
    maximum: number;
    maximumLabel: string;
    minimum: number;
    minimumLabel: string;
    onSelectAmount: (amount: number) => void;
    sendLabel: string;
    separator: string;
};

const SwapLimit = (props: SwapLimitProps) => {
    return (
        <span>
            {props.label}
            <span onClick={() => props.onClick()} class="btn-small btn-light">
                {formatAmount(
                    BigNumber(props.amount),
                    props.denomination,
                    props.separator,
                    props.asset,
                )}
            </span>
            <span class="denominator" data-denominator={props.icon} />
        </span>
    );
};

const SwapLimits = (props: SwapLimitsProps) => {
    const denomination = () => {
        return props.asset === USDT0 ? USDT0 : props.denomination;
    };

    return (
        <span class="swap-limits">
            <SwapLimit
                amount={props.minimum}
                asset={props.asset}
                icon={denomination()}
                denomination={props.denomination}
                label={`${props.sendLabel} ${props.minimumLabel}:`}
                onClick={() => props.onSelectAmount(props.minimum)}
                separator={props.separator}
            />
            <SwapLimit
                amount={props.maximum}
                asset={props.asset}
                icon={denomination()}
                denomination={props.denomination}
                label={`${props.maximumLabel}:`}
                onClick={() => props.onSelectAmount(props.maximum)}
                separator={props.separator}
            />
        </span>
    );
};

export default SwapLimits;
