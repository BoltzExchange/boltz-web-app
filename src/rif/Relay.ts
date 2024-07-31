import { config } from "../config";
import { RBTC } from "../consts/Assets";

export type Metadata = {
    signature?: string;
    relayMaxNonce: number;
    relayHubAddress: string;
};

const sendPostRequest = (url: string, body: any) =>
    fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

const handleResponse = async (res: Response) => {
    const json = await res.json();
    if ("error" in json) {
        throw json.error;
    }

    return json;
};

export const getChainInfo = (): Promise<{
    relayWorkerAddress: string;
    feesReceiver: string;
    relayManagerAddress: string;
    relayHubAddress: string;
    minGasPrice: string;
    chainId: string;
    networkId: string;
    ready: boolean;
    version: string;
}> => fetch(`${config.assets[RBTC].rifRelay}/chain-info`).then(handleResponse);

export const estimate = (
    relay: Record<string, any>,
    metadata: Metadata,
): Promise<{
    gasPrice: string;
    estimation: string;
    requiredTokenAmount: string;
    requiredNativeAmount: string;
    exchangeRate: string;
}> =>
    sendPostRequest(`${config.assets[RBTC].rifRelay}/estimate`, {
        metadata,
        relayRequest: relay,
    }).then(handleResponse);

export const relay = (
    relay: Record<string, any>,
    metadata: Metadata,
): Promise<{
    txHash: string;
    signedTx: string;
}> =>
    sendPostRequest(`${config.assets[RBTC].rifRelay}/relay`, {
        metadata,
        relayRequest: relay,
    }).then(handleResponse);
