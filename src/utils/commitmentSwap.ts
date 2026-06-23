import { bridgeRegistry } from "boltz-swaps/bridge";
import { AssetKind, SwapType } from "boltz-swaps/types";

import { getKindForAsset } from "../consts/Assets";
import { Side } from "../consts/Enums";
import type Pair from "./Pair";

export const canCommitSubmarineSendAmount = (
    pair: Pair,
    amountChanged: Side,
) => {
    const commitmentAsset =
        bridgeRegistry.getPreRoute(pair.fromAsset)?.destinationAsset ??
        pair.fromAsset;

    return (
        pair.swapToCreate?.type === SwapType.Submarine &&
        amountChanged === Side.Send &&
        pair.hasPreBoltzDex &&
        getKindForAsset(commitmentAsset) === AssetKind.ERC20
    );
};
