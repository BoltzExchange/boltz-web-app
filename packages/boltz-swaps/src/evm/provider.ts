import {
    type PublicClient,
    type Transport,
    createPublicClient,
    fallback,
    http,
} from "viem";

import { requireRpcUrls } from "../config.ts";

export const createProviderTransport = (
    rpcUrls: readonly string[],
): Transport =>
    rpcUrls.length === 1
        ? http(rpcUrls[0])
        : fallback(
              rpcUrls.map((url) => http(url)),
              { rank: false },
          );

export const createProvider = (
    rpcUrls: readonly string[] | undefined,
): PublicClient => {
    if (rpcUrls === undefined || rpcUrls.length === 0) {
        throw new Error("missing RPC configuration");
    }

    return createPublicClient({ transport: createProviderTransport(rpcUrls) });
};

export const createAssetProvider = (asset: string): PublicClient =>
    createProvider(requireRpcUrls(asset));
