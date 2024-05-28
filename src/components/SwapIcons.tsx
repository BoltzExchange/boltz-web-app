import { VsArrowSmallRight } from "solid-icons/vs";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { SomeSwap } from "../utils/swapCreator";

export const SwapIcons = ({ swap }: { swap: SomeSwap }) => {
    return (
        <span class="swaplist-asset">
            <span
                data-asset={
                    swap.type === SwapType.Reverse ? LN : swap.assetSend
                }></span>
            <VsArrowSmallRight />
            <span
                data-asset={
                    swap.type === SwapType.Submarine ? LN : swap.assetReceive
                }></span>
        </span>
    );
};
