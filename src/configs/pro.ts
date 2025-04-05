import { Config, baseConfig, chooseUrl } from "src/configs/base";
import { config as mainnetConfig } from "src/configs/mainnet";

const config = {
    ...baseConfig,
    ...mainnetConfig,
    isPro: true,
} as Config;

export { config, chooseUrl };
