import type { Config } from "src/configs/base";
import { baseConfig, chooseUrl } from "src/configs/base";
import { config as mainnetConfig } from "src/configs/mainnet";

const config = {
    ...baseConfig,
    ...mainnetConfig,
    isPro: true,
    torUrl: "http://boltzprool37sw3uqwj3r2wes2tcbwtaljja36zeiurj2azcmmhh47yd.onion/",
} as Config;

export { config, chooseUrl };
