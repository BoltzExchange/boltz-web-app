import { type BoltzSwapsConfig } from "../../src/config.ts";
import { type MainnetAsset, mainnetConfig } from "../../src/presets/mainnet.ts";
import { type Asset } from "../../src/types.ts";

export const mainnetAssets = mainnetConfig.assets as Record<
    MainnetAsset,
    Asset
>;

export const mainnetBoltzSwapsConfig: BoltzSwapsConfig = mainnetConfig;

export const cctpApiUrl = mainnetConfig.cctpApiUrl!;
export const cctpExplorerUrl = mainnetConfig.cctpExplorerUrl!;
export const layerZeroExplorerUrl = mainnetConfig.layerZeroExplorerUrl!;
export const oftDeploymentsUrl = mainnetConfig.oftDeploymentsUrl!;
