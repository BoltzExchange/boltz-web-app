import { OcLinkexternal2 } from "solid-icons/oc";
import { VsArrowSmallRight } from "solid-icons/vs";
import { For, Show } from "solid-js";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { type Pairs } from "../utils/boltzClient";
import ExternalLink from "./ExternalLink";
import { getFeeHighlightClass } from "./Fees";
import LoadingSpinner from "./LoadingSpinner";

type SwapFees = {
    assetSend: string;
    assetReceive: string;
    proFee: number;
    regularFee: number;
    swapType: SwapType;
};

export const FeeComparisonTable = (props: {
    proPairs: Pairs;
    regularPairs: Pairs;
    onSelect: (opportunity: SwapFees) => void;
}) => {
    const { t } = useGlobalContext();

    const getSwapFees = (
        proPairs: Pairs,
        regularPairs: Pairs,
        swapType: SwapType,
    ): SwapFees[] => {
        const result: SwapFees[] = [];

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
                getSwapFees(pro[key], regular[key], type).filter(
                    (swap) => swap.proFee < swap.regularFee,
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
                    <Show
                        when={filterOpportunities().length > 0}
                        fallback={
                            <tr
                                class="fee-comparison-row no-data-row"
                                data-testid="no-opportunities-found">
                                <td colSpan={3}>
                                    <span>
                                        {t("no_opportunities_found.text")}
                                    </span>
                                    <div class="fee-comparison-alerts">
                                        {t(
                                            "no_opportunities_found.telegram_bot_text",
                                        )}{" "}
                                        <ExternalLink href="https://t.me/boltz_pro_bot">
                                            {t(
                                                "no_opportunities_found.telegram_bot",
                                            )}
                                            <OcLinkexternal2 size={14} />
                                        </ExternalLink>
                                    </div>
                                </td>
                            </tr>
                        }>
                        <For each={filterOpportunities()}>
                            {(opportunity) => (
                                <tr
                                    class="fee-comparison-row"
                                    onClick={() => props.onSelect(opportunity)}>
                                    <td>
                                        <div class="swaplist-asset">
                                            <span
                                                data-asset={
                                                    opportunity.assetSend
                                                }
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
                                            class={getFeeHighlightClass(
                                                opportunity.proFee,
                                                opportunity.regularFee,
                                            )}>
                                            {opportunity.proFee}%
                                        </span>
                                    </td>
                                    <td>
                                        <strong>
                                            {opportunity.regularFee}%
                                        </strong>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </Show>
                </tbody>
            </table>
        </Show>
    );
};

export default FeeComparisonTable;
