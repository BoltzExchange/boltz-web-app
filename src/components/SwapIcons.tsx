import { VsArrowSmallRight } from "solid-icons/vs";

import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { SomeSwap } from "../utils/swapCreator";

export const SwapIcons = (props: { swap: SomeSwap }) => {
    return (
        <span class="swaplist-asset">
            <span
                data-asset={
                    props.swap.type === SwapType.Reverse
                        ? LN
                        : props.swap.assetSend
                }
            />
            <VsArrowSmallRight />
            <span
                data-asset={
                    props.swap.type === SwapType.Submarine
                        ? LN
                        : props.swap.assetReceive
                }
            />
        </span>
    );
};
