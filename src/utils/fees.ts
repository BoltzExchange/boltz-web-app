import log from "loglevel";

import { getExplorerFeeEstimations } from "./blockchain";
import { getFeeEstimations } from "./boltzClient";

export const getFeeEstimationsFailover = async (asset: string) => {
    try {
        const feeEstimations = await getFeeEstimations();

        return feeEstimations[asset];
    } catch (e) {
        log.warn(
            `failed to get fee estimations via Boltz API for ${asset}: ${e}`,
        );
    }

    return getExplorerFeeEstimations(asset);
};
