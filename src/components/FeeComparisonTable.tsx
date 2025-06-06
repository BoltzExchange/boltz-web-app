import { VsArrowSmallRight } from "solid-icons/vs";
import { For, Show } from "solid-js";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { type Pairs } from "../utils/boltzClient";
import LoadingSpinner from "./LoadingSpinner";

type FeeComparison = {
    assetSend: string;
    assetReceive: string;
    proFee: number;
    regularFee: number;
    swapType: SwapType;
};

export const FeeComparisonTable = (props: {
    proPairs: Pairs;
    regularPairs: Pairs;
    onSelect: (opportunity: FeeComparison) => void;
}) => {
    const { t } = useGlobalContext();

    const extractFeeDifferences = (
        proPairs: Pairs,
        regularPairs: Pairs,
        swapType: SwapType,
    ): FeeComparison[] => {
        const result: FeeComparison[] = [];

        for (const assetSend of Object.keys(proPairs)) {
            for (const assetReceive of Object.keys(proPairs[assetSend])) {
                result.push({
                    swapType,
                    assetSend: swapType === SwapType.Reverse ? LN : assetSend,
                    assetReceive:
                        swapType === SwapType.Submarine ? LN : assetReceive,
                    proFee: proPairs[assetSend][assetReceive].fees.percentage,
                    regularFee:
                        regularPairs[assetSend][assetReceive].fees.percentage,
                });
            }
        }

        return result;
    };

    const filterOpportunities = () => {
        const pro = props.proPairs;
        const regular = props.regularPairs;

        const swapTypes = [
            { type: SwapType.Chain, key: "chain" },
            { type: SwapType.Reverse, key: "reverse" },
            { type: SwapType.Submarine, key: "submarine" },
        ];

        return swapTypes
            .flatMap(({ type, key }) =>
                extractFeeDifferences(pro[key], regular[key], type).filter(
                    (opportunity) =>
                        opportunity.proFee < opportunity.regularFee,
                ),
            )
            .sort((a, b) => a.proFee - b.proFee);
    };
    return (
        <Show
            when={props.proPairs && props.regularPairs}
            fallback={<LoadingSpinner />}>
            <table class="fee-comparison-table">
                <thead>
                    <tr>
                        <th>{t("swap")}</th>
                        <th>{t("pro_fee")}</th>
                        <th>{t("regular_fee")}</th>
                    </tr>
                </thead>
                <tbody>
                    <For each={filterOpportunities()}>
                        {(opportunity) => (
                            <tr
                                class="fee-comparison-row"
                                onClick={() => props.onSelect(opportunity)}>
                                <td>
                                    <div class="swaplist-asset">
                                        <span
                                            data-asset={opportunity.assetSend}
                                        />
                                        <VsArrowSmallRight />
                                        <span
                                            data-asset={
                                                opportunity.assetReceive
                                            }
                                        />
                                    </div>
                                </td>
                                <td>
                                    <span
                                        class={`${
                                            opportunity.proFee < 0
                                                ? "positive-fee"
                                                : "negative-fee"
                                        }`}>
                                        {opportunity.proFee}%
                                    </span>
                                </td>
                                <td>
                                    <strong>{opportunity.regularFee}%</strong>
                                </td>
                            </tr>
                        )}
                    </For>
                </tbody>
            </table>
        </Show>
    );
};

export default FeeComparisonTable;
