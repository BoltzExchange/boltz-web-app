import {
    FallbackProvider as EthersFallbackProvider,
    type Provider as EthersProvider,
    JsonRpcProvider,
} from "ethers";

import { formatError } from "./errors";

export type Provider = EthersProvider & {
    send: (method: string, params: unknown[]) => Promise<unknown>;
};

export class FallbackProvider extends EthersFallbackProvider {
    constructor(private readonly providers: JsonRpcProvider[]) {
        super(providers);
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

export const createProvider = (rpcUrls: string[]): Provider => {
    if (rpcUrls.length === 1) {
        return new JsonRpcProvider(rpcUrls[0]);
    }

    return new FallbackProvider(rpcUrls.map((url) => new JsonRpcProvider(url)));
};
