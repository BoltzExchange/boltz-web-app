import type { RestorableSwap } from "boltz-swaps/client";
import { VsArrowSmallRight } from "solid-icons/vs";
import { Show } from "solid-js";

import { getAssetDisplaySymbol, getNetworkBadge } from "../consts/Assets";
import "../style/asset.scss";
import {
    type SomeSwap,
    getFinalAssetReceive,
    getFinalAssetSend,
} from "../utils/swapCreator";

export const SwapListAssetIcon = (props: { asset: string }) => (
    <span
        class={`asset asset-${getAssetDisplaySymbol(props.asset)}`}
        data-asset={getAssetDisplaySymbol(props.asset)}
        data-network={getNetworkBadge(props.asset)}>
        <span class="icon" />
    </span>
);

export const SwapIcons = (props: { swap: SomeSwap | RestorableSwap }) => {
    return (
        <Show
            when={"assetSend" in props.swap}
            fallback={
                <span class="swaplist-asset">
                    <SwapListAssetIcon
                        asset={(props.swap as RestorableSwap).to}
                    />
                </span>
            }>
            <span class="swaplist-asset">
                <SwapListAssetIcon
                    asset={getFinalAssetSend(props.swap as SomeSwap, true)}
                />
                <VsArrowSmallRight />
                <SwapListAssetIcon
                    asset={getFinalAssetReceive(props.swap as SomeSwap, true)}
                />
            </span>
        </Show>
    );
};
