import log from "loglevel";

import { chooseUrl, config } from "../config";
import { BlockExplorer } from "../consts/Enums";
import { broadcastTransaction as boltzBroadcastTransaction } from "./boltzClient";
import { fetcher } from "./helper";

export const broadcastTransaction = async (
    blockExplorer: BlockExplorer,
    asset: string,
    txHex: string,
) => {
    if (blockExplorer === BlockExplorer.Boltz) {
        return boltzBroadcastTransaction(asset, txHex);
    }
    let url = undefined;
    if (blockExplorer === BlockExplorer.Mempool) {
        url = chooseUrl(config.assets[asset].broadcastUrl?.mempool);
    }
    if (blockExplorer === BlockExplorer.Blockstream) {
        url = chooseUrl(config.assets[asset].broadcastUrl?.blockstream);
    }
    if (!url) {
        log.error("No broadcast URL found for asset", asset, blockExplorer);
    }
    return fetcher<{ id: string }>(url, asset, {
        hex: txHex,
    });
};
