import { VsArrowSmallRight } from "solid-icons/vs";
import { Show } from "solid-js";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { RestorableSwap } from "../utils/boltzClient";
import type { SomeSwap } from "../utils/swapCreator";

export const SwapIcons = (props: { swap: SomeSwap | RestorableSwap }) => {
    const assetTo = (): string => {
        const swap = props.swap as SomeSwap;
        if (swap.hops !== undefined && swap.hops.length > 0) {
            return swap.hops[swap.hops.length - 1].to;
        }

        return swap.type === SwapType.Reverse ? LN : swap.assetReceive;
    };

    return (
        <Show
            when={"assetSend" in props.swap}
            fallback={
                <span class="swaplist-asset">
                    <span data-asset={(props.swap as RestorableSwap).to} />
                </span>
            }>
            <span class="swaplist-asset">
                <span
                    data-asset={
                        props.swap.type === SwapType.Reverse
                            ? LN
                            : (props.swap as SomeSwap).assetSend
                    }
                />
                <VsArrowSmallRight />
                <span data-asset={assetTo()} />
            </span>
        </Show>
    );
};
