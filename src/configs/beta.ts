import type { Config } from "src/configs/base";
import { baseConfig, chooseUrl } from "src/configs/base";
import { config as mainnetConfig } from "src/configs/mainnet";

const config = {
    ...baseConfig,
    ...mainnetConfig,
    isBeta: true,
} as Config;

export { config, chooseUrl };
