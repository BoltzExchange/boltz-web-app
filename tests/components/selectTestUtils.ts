import { isBridgeVariant } from "../../src/consts/Assets";
import Pair from "../../src/utils/Pair";
import { signals } from "../helper";

type TestAsset = {
    canSend?: boolean;
    bridge?: {
        canonicalAsset: string;
    };
};

export const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

export const getBridgeVariantAssets = (assets: Record<string, TestAsset>) =>
    Object.keys(assets).filter((asset) => isBridgeVariant(asset));

export const getSendableBridgeVariantAssets = (
    assets: Record<string, TestAsset>,
) =>
    getBridgeVariantAssets(assets).filter(
        (asset) => assets[asset]?.canSend !== false,
    );

export const getUnsendableBridgeVariantAssets = (
    assets: Record<string, TestAsset>,
) =>
    getBridgeVariantAssets(assets).filter(
        (asset) => assets[asset]?.canSend === false,
    );
