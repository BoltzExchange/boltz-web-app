import { VsArrowSmallRight } from "solid-icons/vs";
import { Show } from "solid-js";

import type { RestorableSwap } from "../utils/boltzClient";
import {
    type SomeSwap,
    getFinalAssetReceive,
    getFinalAssetSend,
} from "../utils/swapCreator";

export const SwapIcons = (props: { swap: SomeSwap | RestorableSwap }) => {
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
                    data-asset={getFinalAssetSend(props.swap as SomeSwap, true)}
                />
                <VsArrowSmallRight />
                <span
                    data-asset={getFinalAssetReceive(
                        props.swap as SomeSwap,
                        true,
                    )}
                />
            </span>
        </Show>
    );
};
