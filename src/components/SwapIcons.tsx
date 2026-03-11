import { VsArrowSmallRight } from "solid-icons/vs";
import { Show } from "solid-js";

import { getAssetDisplaySymbol } from "../consts/Assets";
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
                    <span
                        data-asset={getAssetDisplaySymbol(
                            (props.swap as RestorableSwap).to,
                        )}
                    />
                </span>
            }>
            <span class="swaplist-asset">
                <span
                    data-asset={getAssetDisplaySymbol(
                        getFinalAssetSend(props.swap as SomeSwap, true),
                    )}
                />
                <VsArrowSmallRight />
                <span
                    data-asset={getAssetDisplaySymbol(
                        getFinalAssetReceive(props.swap as SomeSwap, true),
                    )}
                />
            </span>
        </Show>
    );
};
