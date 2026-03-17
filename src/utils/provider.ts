import {
    FallbackProvider as EthersFallbackProvider,
    type Provider as EthersProvider,
    JsonRpcProvider,
} from "ethers";

import { config } from "../config";
import { formatError } from "./errors";

export type Provider = EthersProvider & {
    send: (method: string, params: unknown[]) => Promise<unknown>;
};

class FallbackProvider extends EthersFallbackProvider {
    constructor(private readonly providers: JsonRpcProvider[]) {
        super(providers, undefined, { quorum: 1 });
    }

    public send = async (
        method: string,
        params: Array<unknown> | Record<string, unknown>,
    ): Promise<unknown> => {
        const prms = await Promise.allSettled(
            this.providers.map((provider) => provider.send(method, params)),
        );

        if (prms.every((prm) => prm.status === "rejected")) {
            throw new Error(
                prms.map((prm) => formatError(prm.reason)).join(", "),
            );
        }

        return prms.find((prm) => prm.status === "fulfilled")?.value;
    };
}

export const getOptionalAssetRpcUrls = (
    asset: string,
): string[] | undefined => {
    const rpcUrls = config.assets?.[asset]?.network?.rpcUrls;

    return rpcUrls && rpcUrls.length > 0 ? rpcUrls : undefined;
};

export const getAssetRpcUrls = (asset: string): string[] => {
    const rpcUrls = getOptionalAssetRpcUrls(asset);
    if (rpcUrls === undefined || rpcUrls.length === 0) {
        throw new Error(`missing RPC configuration for asset: ${asset}`);
    }

    return rpcUrls;
};

export const createProvider = (rpcUrls: string[] | undefined): Provider => {
    if (rpcUrls === undefined || rpcUrls.length === 0) {
        throw new Error("missing RPC configuration");
    }

    if (rpcUrls.length === 1) {
        return new JsonRpcProvider(rpcUrls[0]);
    }

    return new FallbackProvider(rpcUrls.map((url) => new JsonRpcProvider(url)));
};

export const createAssetProvider = (asset: string): Provider =>
    createProvider(getAssetRpcUrls(asset));
