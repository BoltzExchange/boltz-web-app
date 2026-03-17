import { isUsdt0Variant } from "../../src/consts/Assets";
import Pair from "../../src/utils/Pair";
import { signals } from "../helper";

type TestAsset = {
    canSend?: boolean;
};

export const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

const getUsdt0VariantAssets = (assets: Record<string, TestAsset>) =>
    Object.keys(assets).filter((asset) => isUsdt0Variant(asset));

export const getSendableUsdt0VariantAssets = (
    assets: Record<string, TestAsset>,
) =>
    getUsdt0VariantAssets(assets).filter(
        (asset) => assets[asset]?.canSend !== false,
    );

export const getUnsendableUsdt0VariantAssets = (
    assets: Record<string, TestAsset>,
) =>
    getUsdt0VariantAssets(assets).filter(
        (asset) => assets[asset]?.canSend === false,
    );

export const getUsdt0Variants = (assets: Record<string, TestAsset>) =>
    getUsdt0VariantAssets(assets);
