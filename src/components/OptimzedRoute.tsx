import { useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import log from "loglevel";
import { createResource } from "solid-js";
import { Show } from "solid-js";

import { LBTC, LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type {
    ChainPairTypeTaproot,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "../utils/boltzClient";
import { calculateBoltzFeeOnSend } from "../utils/calculate";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { getPair, isMobile } from "../utils/helper";
import type {
    ChainSwap,
    MrhSwap,
    ReverseSwap,
    SubmarineSwap,
} from "../utils/swapCreator";
import {
    unconfidentialExtra as extraFee,
    isToUnconfidentialLiquid,
} from "./Fees";
import Tooltip from "./settings/Tooltip";

const OptimizedRoute = () => {
    const { t, getMrhSwapStorage, pairs, denomination, separator } =
        useGlobalContext();
    const { swapType, assetSend, assetReceive, addressValid, onchainAddress } =
        useCreateContext();
    const { swap } = usePayContext();

    const params = useParams<{ id: string }>();

    const [mrhSwap] = createResource(async () => {
        return await getMrhSwapStorage(params.id);
    });

    const unconfidentialExtra = isToUnconfidentialLiquid({
        assetReceive,
        addressValid,
        onchainAddress,
    })
        ? extraFee
        : 0;

    const getTotalChainFees = (mrhSwap: MrhSwap) => {
        const chainPair = getPair(
            pairs(),
            SwapType.Chain,
            mrhSwap.from,
            LBTC,
        ) as ChainPairTypeTaproot;

        const chainMinerFees =
            chainPair.fees.minerFees.server +
            chainPair.fees.minerFees.user.claim;
        return calculateBoltzFeeOnSend(
            BigNumber((swap() as ChainSwap).lockupDetails.amount),
            chainPair.fees.percentage,
            chainMinerFees,
            swapType(),
        )
            .plus(chainMinerFees)
            .plus(unconfidentialExtra);
    };

    const getTotalSubmarineFees = (mrhSwap: MrhSwap) => {
        const submarinePair = getPair(
            pairs(),
            SwapType.Submarine,
            mrhSwap.from,
            LN,
        ) as SubmarinePairTypeTaproot;

        return calculateBoltzFeeOnSend(
            BigNumber((swap() as SubmarineSwap).sendAmount),
            submarinePair.fees.percentage,
            submarinePair.fees.minerFees,
            SwapType.Submarine,
        ).plus(submarinePair.fees.minerFees);
    };

    const getTotalReverseFees = (sendAmount: BigNumber) => {
        const reversePair = getPair(
            pairs(),
            SwapType.Reverse,
            LN,
            LBTC,
        ) as ReversePairTypeTaproot;

        const reverseMinerFees =
            reversePair.fees.minerFees.claim +
            reversePair.fees.minerFees.lockup;
        return calculateBoltzFeeOnSend(
            sendAmount,
            reversePair.fees.percentage,
            reverseMinerFees,
            swapType(),
        )
            .plus(reverseMinerFees)
            .plus(unconfidentialExtra);
    };

    const [savedFees] = createResource(pairs, async () => {
        try {
            const mrhSwap = await getMrhSwapStorage(params.id);

            const chainFee = getTotalChainFees(mrhSwap);
            const submarineFee = getTotalSubmarineFees(mrhSwap);
            const reverseFee = getTotalReverseFees(
                BigNumber((swap() as ReverseSwap).sendAmount).minus(
                    submarineFee,
                ),
            );

            return chainFee
                .minus(submarineFee.plus(reverseFee))
                .absoluteValue();
        } catch (e) {
            log.error("Error getting mrh swap storage", params.id, e);
            return BigNumber(0);
        }
    });

    return (
        <Show when={mrhSwap()}>
            <span class="optimized-route">
                ✨{" "}
                <Show when={savedFees()} fallback={<>{t("optimized_route")}</>}>
                    {t("optimized_route_amount", {
                        amount: formatAmount(
                            savedFees(),
                            denomination(),
                            separator(),
                        ),
                        denomination: formatDenomination(
                            denomination(),
                            assetSend(),
                        ),
                    })}
                </Show>
                <Tooltip
                    label={"applied_routing_hint"}
                    size={18}
                    direction={isMobile() ? "left" : "right"}
                />
            </span>
        </Show>
    );
};

export default OptimizedRoute;
