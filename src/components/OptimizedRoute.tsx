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
import type { ChainSwap } from "../utils/swapCreator";
import {
    unconfidentialExtra as extraFee,
    isToUnconfidentialLiquid,
} from "./Fees";
import Tooltip from "./settings/Tooltip";

const getTotalChainFees = ({
    pairs,
    sendAmount,
    assetSend,
    unconfidentialExtra,
}: {
    sendAmount: Accessor<BigNumber>;
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
        sendAmount(),
        chainPair.fees.percentage,
        chainMinerFees,
        SwapType.Chain,
    )
        .plus(chainMinerFees)
        .plus(unconfidentialExtra);
};

const getTotalSubmarineFees = ({
    pairs,
    sendAmount,
    assetSend,
}: {
    pairs: Accessor<Pairs>;
    sendAmount: Accessor<BigNumber>;
    assetSend: Accessor<string>;
}) => {
    const submarinePair = getPair(
        pairs(),
        SwapType.Submarine,
        assetSend(),
        LN,
    ) as SubmarinePairTypeTaproot;

    return calculateBoltzFeeOnSend(
        sendAmount(),
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

export const getMagicRoutingHintSavedFees = ({
    pairs,
    assetSend,
    sendAmount,
    assetReceive,
    addressValid,
    onchainAddress,
}: {
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
        sendAmount,
        assetSend,
        unconfidentialExtra,
    });
    const submarineFee = getTotalSubmarineFees({
        pairs,
        sendAmount,
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
    const params = useParams<{ id: string }>();

    const { t, denomination, separator, getSwap } = useGlobalContext();
    const { assetSend, assetReceive } = useCreateContext();

    const [swap] = createResource(async () => {
        if (typeof params.id !== "string") {
            return undefined;
        }

        return await getSwap<ChainSwap>(params.id);
    });

    return (
        <Show
            when={
                swap.state === "ready" &&
                swap()?.magicRoutingHintSavedFees !== undefined
            }>
            <span class="optimized-route">
                ✨{" "}
                {t("optimized_route_amount", {
                    amount: formatAmount(
                        BigNumber(swap().magicRoutingHintSavedFees),
                        denomination(),
                        separator(),
                    ),
                    denomination: formatDenomination(
                        denomination(),
                        assetSend(),
                    ),
                })}
                <Tooltip
                    label={{
                        key: "applied_routing_hint",
                        variables: {
                            asset: assetReceive(),
                        },
                    }}
                    size={18}
                    direction={isMobile() ? "left" : "right"}
                />
            </span>
        </Show>
    );
};

export default OptimizedRoute;
