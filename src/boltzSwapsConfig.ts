import { setBoltzSwapsConfig } from "boltz-swaps";

import { config } from "./config";
import { chooseUrl } from "./configs/base";
import { getReferral } from "./utils/helper";
import { gasTopUpSupported, getGasTopUpNativeAmount } from "./utils/quoter";

export const configureBoltzSwaps = () => {
    setBoltzSwapsConfig({
        get assets() {
            return config.assets;
        },
        get cctpApiUrl() {
            return config.cctpApiUrl;
        },
        get solburnUrl() {
            return config.solburnUrl;
        },
        get layerZeroExplorerUrl() {
            return config.layerZeroExplorerUrl;
        },
        get cctpExplorerUrl() {
            return config.cctpExplorerUrl;
        },
        get oftDeploymentsUrl() {
            return config.oftDeploymentsUrl;
        },
        get boltzApiUrl() {
            return chooseUrl(config.apiUrl);
        },
        get referral() {
            return getReferral();
        },
        get gasSponsor() {
            return chooseUrl(config.gasSponsor);
        },
        get network() {
            return config.network;
        },
        gasTopUpSupported,
        getGasTopUpNativeAmount,
        cooperativeDisabled: config.cooperativeDisabled === true,
    });
};
