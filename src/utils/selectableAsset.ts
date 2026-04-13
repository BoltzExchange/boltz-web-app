import { config } from "../config";
import { isTor } from "../configs/base";
import { TBTC, USDT0, isUsdt0Variant } from "../consts/Assets";
import { Side } from "../consts/Enums";

export const canSendAsset = (asset: string) =>
    config.assets[asset]?.canSend !== false;

export const canSelectAsset = (
    selectedSide: Side | string | null | undefined,
    asset: string,
) => {
    if (
        isTor() &&
        (asset === TBTC || asset === USDT0 || isUsdt0Variant(asset))
    ) {
        return false;
    }

    return selectedSide !== Side.Send || canSendAsset(asset);
};
