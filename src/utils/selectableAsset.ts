import { config } from "../config";
import { isTor } from "../configs/base";
import { TBTC, isBridgeAsset } from "../consts/Assets";
import { Side } from "../consts/Enums";

export const canSendAsset = (asset: string) =>
    config.assets[asset]?.canSend !== false;

export const isAssetDisabled = (asset: string) =>
    config.assets[asset]?.disabled === true;

export const canSelectAsset = (
    selectedSide: Side | string | null | undefined,
    asset: string,
) => {
    if (isTor() && (asset === TBTC || isBridgeAsset(asset))) {
        return false;
    }

    return selectedSide !== Side.Send || canSendAsset(asset);
};
