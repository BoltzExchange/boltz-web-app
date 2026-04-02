import { isEvmAsset } from "../consts/Assets";
import type Pair from "./Pair";

export const shouldPreserveOnchainAddress = (
    currentPair: Pair,
    nextPair: Pair,
) =>
    nextPair.toAsset === currentPair.toAsset ||
    (isEvmAsset(currentPair.toAsset) && isEvmAsset(nextPair.toAsset));
