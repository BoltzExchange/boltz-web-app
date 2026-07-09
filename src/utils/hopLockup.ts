import type { Pairs } from "boltz-swaps/client";
import { assetAmountToSats } from "boltz-swaps/evm";
import { calculateAmountOutMin } from "boltz-swaps/helper";
import { SwapType } from "boltz-swaps/types";
import type { Accessor } from "solid-js";

import type { ChainSwap, SomeSwap } from "./swapCreator";

// A shortfall is only lockable for chain swaps whose lockup still clears the
// pair minimum (the backend renegotiates those); otherwise it is rejected as
// "insufficient amount" and must block. Assumes the caller already checked the
// quote is below the required amount.
export const hopShortfallIsRenegotiable = async (
    swap: SomeSwap,
    quoteAmountOut: bigint,
    slippage: number,
    pairs: Accessor<Pairs | undefined>,
    fetchPairs: () => Promise<void>,
): Promise<boolean> => {
    if (swap.type !== SwapType.Chain) {
        return false;
    }

    const chainSwap = swap as ChainSwap;
    const lockupAmount = calculateAmountOutMin(quoteAmountOut, slippage);
    await fetchPairs();
    const minimal =
        pairs()?.[SwapType.Chain]?.[chainSwap.assetSend]?.[
            chainSwap.assetReceive
        ]?.limits.minimal;

    return (
        minimal === undefined ||
        assetAmountToSats(lockupAmount, chainSwap.assetSend) >= BigInt(minimal)
    );
};
