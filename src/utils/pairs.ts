import { BTC, LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { Pairs } from "./boltzClient";

export const isPairValid = (
    pairs: Pairs | undefined,
    assetSend: string,
    assetReceive: string,
): boolean => {
    if (pairs === undefined) {
        return false;
    }

    // Wrap in a try/catch to prevent throws when reading properties of undefined
    try {
        if (assetReceive === LN) {
            return pairs[SwapType.Submarine][assetSend][BTC] !== undefined;
        } else if (assetSend === LN) {
            return pairs[SwapType.Reverse][BTC][assetReceive] !== undefined;
        } else {
            return pairs[SwapType.Chain][assetSend][assetReceive] !== undefined;
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};
