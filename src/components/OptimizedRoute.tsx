import { useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import type { Accessor } from "solid-js";
import { createResource } from "solid-js";
import { Show } from "solid-js";

import { LBTC, LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import type {
    ChainPairTypeTaproot,
    Pairs,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "../utils/boltzClient";
import { calculateBoltzFeeOnSend } from "../utils/calculate";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { getPair, isMobile } from "../utils/helper";
import type { ChainSwap, SomeSwap, SubmarineSwap } from "../utils/swapCreator";
import {
    unconfidentialExtra as extraFee,
    isToUnconfidentialLiquid,
} from "./Fees";
import Tooltip from "./settings/Tooltip";

const getTotalChainFees = ({
    pairs,
    swap,
    assetSend,
    unconfidentialExtra,
}: {
    swap: SomeSwap;
    pairs: Accessor<Pairs>;
    assetSend: Accessor<string>;
    unconfidentialExtra: number;
}) => {
    const chainPair = getPair(
        pairs(),
        SwapType.Chain,
        assetSend(),
        LBTC,
    ) as ChainPairTypeTaproot;

    const chainMinerFees =
        chainPair.fees.minerFees.server + chainPair.fees.minerFees.user.claim;
    return calculateBoltzFeeOnSend(
        BigNumber((swap as ChainSwap).lockupDetails.amount),
        chainPair.fees.percentage,
        chainMinerFees,
        SwapType.Chain,
    )
        .plus(chainMinerFees)
        .plus(unconfidentialExtra);
};

const getTotalSubmarineFees = ({
    pairs,
    swap,
    assetSend,
}: {
    pairs: Accessor<Pairs>;
    swap: SomeSwap;
    assetSend: Accessor<string>;
}) => {
    const submarinePair = getPair(
        pairs(),
        SwapType.Submarine,
        assetSend(),
        LN,
    ) as SubmarinePairTypeTaproot;

    return calculateBoltzFeeOnSend(
        BigNumber((swap as SubmarineSwap).sendAmount),
        submarinePair.fees.percentage,
        submarinePair.fees.minerFees,
        SwapType.Submarine,
    ).plus(submarinePair.fees.minerFees);
};

const getTotalReverseFees = ({
    pairs,
    sendAmount,
    unconfidentialExtra,
}: {
    pairs: Accessor<Pairs>;
    sendAmount: Accessor<BigNumber>;
    unconfidentialExtra: number;
}) => {
    const reversePair = getPair(
        pairs(),
        SwapType.Reverse,
        LN,
        LBTC,
    ) as ReversePairTypeTaproot;

    const reverseMinerFees =
        reversePair.fees.minerFees.claim + reversePair.fees.minerFees.lockup;
    return calculateBoltzFeeOnSend(
        sendAmount(),
        reversePair.fees.percentage,
        reverseMinerFees,
        SwapType.Reverse,
    )
        .plus(reverseMinerFees)
        .plus(unconfidentialExtra);
};

export const getSavedFees = ({
    swap,
    pairs,
    assetSend,
    sendAmount,
    assetReceive,
    addressValid,
    onchainAddress,
}: {
    swap: SomeSwap;
    pairs: Accessor<Pairs>;
    assetSend: Accessor<string>;
    sendAmount: Accessor<BigNumber>;
    assetReceive: Accessor<string>;
    addressValid: Accessor<boolean>;
    onchainAddress: Accessor<string>;
}) => {
    const unconfidentialExtra = isToUnconfidentialLiquid({
        assetReceive,
        addressValid,
        onchainAddress,
    })
        ? extraFee
        : 0;

    const chainFee = getTotalChainFees({
        pairs,
        swap,
        assetSend,
        unconfidentialExtra,
    });
    const submarineFee = getTotalSubmarineFees({
        pairs,
        swap,
        assetSend,
    });
    const reverseFee = getTotalReverseFees({
        pairs,
        sendAmount,
        unconfidentialExtra,
    });

    const savedFees = submarineFee.plus(reverseFee).minus(chainFee);

    return savedFees.toString();
};

const OptimizedRoute = () => {
    const { t, getMrhSwapStorage, denomination, separator } =
        useGlobalContext();
    const { assetSend } = useCreateContext();

    const params = useParams<{ id: string }>();

    const [mrhSwap] = createResource(async () => {
        return await getMrhSwapStorage(params.id);
    });

    return (
        <Show when={mrhSwap()}>
            <span class="optimized-route">
                ✨{" "}
                <Show
                    when={mrhSwap()?.savedFees !== undefined}
                    fallback={<>{t("optimized_route")}</>}>
                    {t("optimized_route_amount", {
                        amount: formatAmount(
                            BigNumber(mrhSwap()?.savedFees),
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
