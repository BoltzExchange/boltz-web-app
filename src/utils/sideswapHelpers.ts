import { chooseUrl, config } from "../config";
import { constructRequestOptions } from "./helper";

export const fetchBlockExplorerTx = async (
    asset: string,
    txid: string,
): Promise<string> => {
    const apis = config.assets[asset]?.blockExplorerApis;
    if (!apis?.length) {
        throw new Error(`No block explorer APIs for asset ${asset}`);
    }

    for (const api of apis) {
        const { opts, requestTimeout } = constructRequestOptions();
        try {
            const basePath = chooseUrl(api);
            const res = await fetch(`${basePath}/tx/${txid}/hex`, opts);
            if (res.ok) {
                return await res.text();
            }
        } catch {
            continue;
        } finally {
            clearTimeout(requestTimeout);
        }
    }

    throw new Error(`Could not fetch transaction ${txid} for asset ${asset}`);
};
