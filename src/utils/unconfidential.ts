import { SwapType } from "boltz-swaps/types";
import {
    type UtxoNetwork,
    unconfidentialClaimSurcharge,
} from "boltz-swaps/utxo";

import { config } from "../config";
import { parseBlindingKey } from "./helper";
import type { SomeSwap } from "./swapCreator";

export const claimSurchargeForAddress = (
    assetReceive: string,
    claimAddress: string | undefined,
): number =>
    claimAddress === undefined || claimAddress === ""
        ? 0
        : unconfidentialClaimSurcharge(
              assetReceive,
              claimAddress,
              config.network as UtxoNetwork,
          );

// The claim only injects the OP_RETURN when it spends blinded inputs, which is
// what the lockup blinding key stands for
export const claimSurchargeForSwap = (swap: SomeSwap): number =>
    (swap.type === SwapType.Reverse || swap.type === SwapType.Chain) &&
    parseBlindingKey(swap, false) !== undefined
        ? claimSurchargeForAddress(swap.assetReceive, swap.claimAddress)
        : 0;
