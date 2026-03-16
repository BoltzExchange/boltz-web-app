import { config } from "../config";
import { Side } from "../consts/Enums";

export const canSendAsset = (asset: string) =>
    config.assets[asset]?.canSend !== false;

export const canSelectAsset = (
    selectedSide: Side | string | null | undefined,
    asset: string,
) => selectedSide !== Side.Send || canSendAsset(asset);
