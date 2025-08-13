import log from "loglevel";

import { getFeeEstimationsExternal } from "./blockchain";
import { getFeeEstimations } from "./boltzClient";

export const getFeeEstimationsFailover = async (asset: string) => {
    try {
        const feeEstimations = await getFeeEstimations();

        return feeEstimations[asset];
    } catch (e) {
        log.warn(
            `failed to get fee estimations via Boltz client for ${asset}: ${e}`,
        );
    }

    try {
        log.info(`falling back to external fee estimations`);
        const feeEstimations = await getFeeEstimationsExternal(asset);

        const expectedBlocksToConfirm = "3";

        return feeEstimations[expectedBlocksToConfirm];
    } catch (e) {
        throw new Error(`failed to get fee estimations for ${asset}: ${e}`);
    }
};
