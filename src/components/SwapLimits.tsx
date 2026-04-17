import { BigNumber } from "bignumber.js";

import { getAssetDisplaySymbol, isBridgeAsset } from "../consts/Assets";
import { type Denomination } from "../consts/Enums";
import { formatAmount } from "../utils/denomination";
import AmountDenominator from "./AmountDenominator";

type SwapLimitProps = {
    amount: number;
    asset: string;
    denomination: Denomination;
    label: string;
    onClick: () => void;
    separator: string;
    icon: Denomination | string;
    loading?: boolean;
};

type SwapLimitsProps = {
    asset: string;
    denomination: Denomination;
    loading?: boolean;
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
        <span class="swap-limit">
            <span class="swap-limit-label">{props.label}</span>
            <span class="swap-limit-amount">
                {props.loading ? (
                    <span
                        class="swap-limit-value swap-limit-value-loading"
                        aria-busy="true"
                        aria-disabled="true">
                        <span class="skeleton" aria-hidden="true" />
                    </span>
                ) : (
                    <span
                        onClick={() => props.onClick()}
                        class="btn-small btn-light swap-limit-value">
                        {formatAmount(
                            BigNumber(props.amount),
                            props.denomination,
                            props.separator,
                            props.asset,
                        )}
                    </span>
                )}
                <AmountDenominator value={props.icon} />
            </span>
        </span>
    );
};

const SwapLimits = (props: SwapLimitsProps) => {
    const denomination = () => {
        return isBridgeAsset(props.asset)
            ? getAssetDisplaySymbol(props.asset)
            : props.denomination;
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
                loading={props.loading}
            />
            <SwapLimit
                amount={props.maximum}
                asset={props.asset}
                icon={denomination()}
                denomination={props.denomination}
                label={`${props.maximumLabel}:`}
                onClick={() => props.onSelectAmount(props.maximum)}
                separator={props.separator}
                loading={props.loading}
            />
        </span>
    );
};

export default SwapLimits;
