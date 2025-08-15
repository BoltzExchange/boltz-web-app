import log from "loglevel";

import {
    getEsploraFeeEstimations,
    getMempoolFeeEstimations,
} from "./blockchain";
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

    try {
        log.info(`falling back to Mempool fee estimations`);
        const feeEstimations = await getMempoolFeeEstimations(asset);

        return feeEstimations.halfHourFee;
    } catch (e) {
        log.warn(
            `failed to get fee estimations via Mempool API for ${asset}: ${e}`,
        );
    }

    try {
        log.info(`falling back to Esplora fee estimations`);
        const feeEstimations = await getEsploraFeeEstimations(asset);

        const expectedBlocksToConfirm = "3";

        return feeEstimations[expectedBlocksToConfirm];
    } catch (e) {
        log.warn(
            `failed to get fee estimations via Esplora API for ${asset}: ${e}`,
        );
        throw new Error(`could not get fee estimations for ${asset}`);
    }
};
