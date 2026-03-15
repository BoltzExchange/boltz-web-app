import { config } from "../config";
import { Side } from "../consts/Enums";

export const canSelectAsset = (
    selectedSide: Side | string | null | undefined,
    asset: string,
) => selectedSide !== Side.Send || config.assets[asset]?.canSend !== false;
