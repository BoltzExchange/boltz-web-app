import type { RestorableSwap } from "boltz-swaps/client";
import { VsArrowSmallRight } from "solid-icons/vs";

import { getAssetDisplaySymbol, getNetworkBadge } from "../consts/Assets";
import "../style/asset.scss";
import {
    type BridgeDetail,
    type DexDetail,
    type SomeSwap,
    type SwapAssetRoute,
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

type RestorableSwapWithRoute = RestorableSwap & {
    bridge?: BridgeDetail;
    dex?: DexDetail;
};

export type SwapIconAssets = {
    send: string;
    receive: string;
};

export const getSwapIconAssets = (swap: SomeSwap): SwapIconAssets => ({
    send: getFinalAssetSend(swap, true),
    receive: getFinalAssetReceive(swap, true),
});

export const getRestoredSwapIconAssets = (
    swap: RestorableSwapWithRoute,
): SwapIconAssets => {
    const displaySwap: SwapAssetRoute = {
        type: swap.type,
        assetSend: swap.from,
        assetReceive: swap.to,
        bridge: swap.bridge,
        dex: swap.dex,
    };

    return {
        send: getFinalAssetSend(displaySwap, true),
        receive: getFinalAssetReceive(displaySwap, true),
    };
};

export const SwapIcons = (props: { assets: SwapIconAssets }) => (
    <span class="swaplist-asset">
        <SwapListAssetIcon asset={props.assets.send} />
        <VsArrowSmallRight />
        <SwapListAssetIcon asset={props.assets.receive} />
    </span>
);
