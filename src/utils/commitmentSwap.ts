import type { BigNumber } from "bignumber.js";
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

export const canCreateSubmarineCommitmentSwap = ({
    pair,
    amountChanged,
    sendAmount,
    minimum,
    maximum,
    invoice,
    lnurl,
    bolt12Offer,
    invoiceError,
}: {
    pair: Pair;
    amountChanged: Side;
    sendAmount: BigNumber;
    minimum: number;
    maximum: number;
    invoice: string;
    lnurl: string;
    bolt12Offer: string | undefined;
    invoiceError: string | undefined;
}) =>
    canCommitSubmarineSendAmount(pair, amountChanged) &&
    sendAmount.isFinite() &&
    sendAmount.isGreaterThan(0) &&
    (minimum <= 0 || sendAmount.isGreaterThanOrEqualTo(minimum)) &&
    (maximum <= 0 || sendAmount.isLessThanOrEqualTo(maximum)) &&
    lnurl === "" &&
    (invoice === "" ||
        (bolt12Offer !== undefined && invoice === bolt12Offer)) &&
    invoiceError === undefined;
