import type BigNumber from "bignumber.js";
import bolt11, { type RoutingInfo } from "bolt11";
import type { ChainPairTypeTaproot } from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";
import log from "loglevel";

import { calculateSendAmount } from "./calculate";
import { claimSurchargeForAddress } from "./unconfidential";

const magicRoutingHintConstant = "0846c900051c0000";

// The claim reserves the surcharge out of its output, so the swap has to
// request that much more for the payee to land the amount they invoiced.
export const magicRoutingHintAmounts = (
    chainPair: ChainPairTypeTaproot,
    bip21AmountSats: BigNumber,
    bip21Asset: string,
    chainAddress: string,
) => {
    const surcharge = claimSurchargeForAddress(bip21Asset, chainAddress);
    const receiveAmount = bip21AmountSats.plus(surcharge);

    return {
        surcharge,
        receiveAmount,
        sendAmount: calculateSendAmount(
            receiveAmount,
            chainPair.fees.percentage,
            chainPair.fees.minerFees.server +
                chainPair.fees.minerFees.user.claim,
            SwapType.Chain,
        ),
    };
};

export const findMagicRoutingHint = (invoice: string) => {
    try {
        const decodedInvoice = bolt11.decode(invoice);
        const routingInfo = decodedInvoice.tags.find(
            (tag) => tag.tagName === "routing_info",
        );

        if (!routingInfo) {
            return undefined;
        }

        const magicRoutingHint = (
            routingInfo.data as unknown as RoutingInfo
        ).find((hint) => hint.short_channel_id === magicRoutingHintConstant);

        return magicRoutingHint;
    } catch (e) {
        log.error("Failed to decode invoice", e);
        return undefined;
    }
};
