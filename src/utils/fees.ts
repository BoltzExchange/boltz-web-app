import log from "loglevel";

import { config } from "../config";
import { Explorer } from "../configs/base";
import { BTC, LBTC } from "../consts/Assets";
import { getFeeEstimations as getFeeEstimationsFromExplorer } from "./blockchain";
import { getFeeEstimations } from "./boltzClient";

// HTLCs are time sensitive, so we need to add a floor to the fee estimations
const feeFloors = {
    [BTC]: 2,
    [LBTC]: 0.1,
};

const blockExplorerFeePriority = [Explorer.Mempool, Explorer.Esplora];

const priorityOfBlockExplorer = (id: Explorer) => {
    const idx = blockExplorerFeePriority.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
};

const getExplorerFeeEstimations = async (asset: string) => {
    const apis = config.assets[asset].blockExplorerApis;
    for (const api of [...apis].sort(
        (a, b) => priorityOfBlockExplorer(a.id) - priorityOfBlockExplorer(b.id),
    )) {
        log.debug(`trying to get ${asset} fee estimations from ${api.id}`);

        try {
            const feeEstimation = await getFeeEstimationsFromExplorer(api);
            if (typeof feeEstimation !== "number") {
                throw new Error(`invalid response`);
            }

            return addFloor(asset, feeEstimation);
        } catch (e) {
            log.warn(
                `failed to get fee estimations via ${api.id} API for ${asset}: ${e}`,
            );
        }
    }

    throw new Error(`could not get fallback fee estimations for ${asset}`);
};

const addFloor = (asset: string, fee: number) => {
    const floor = feeFloors[asset];
    if (floor) {
        return Math.max(floor, fee);
    }

    return fee;
};

export const getFeeEstimationsFailover = async (asset: string) => {
    try {
        const feeEstimations = await getFeeEstimations();
        return feeEstimations[asset];
    } catch (e) {
        log.warn(
            `failed to get fee estimations via Boltz API for ${asset}: ${e}`,
        );
    }

    return await getExplorerFeeEstimations(asset);
};
