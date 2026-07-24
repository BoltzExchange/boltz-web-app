import { type Accessor, createResource } from "solid-js";

import { config } from "../config";
import type { Signer } from "../context/Web3";

// Tracks the chain a signer is connected to and whether it matches the
// network configured for an asset
export const createSignerNetworkCheck = (
    signer: Accessor<Signer | undefined>,
    asset: Accessor<string>,
) => {
    const [chainId, { refetch }] = createResource(
        signer,
        async (currentSigner) =>
            Number(await currentSigner.provider.getChainId()),
    );

    // true: the signer is on the asset's network or no chain ID is configured;
    // false: wrong network; undefined: the signer's chain ID is still unknown
    const valid = (): boolean | undefined => {
        const expected = config.assets?.[asset()]?.network?.chainId;
        if (expected === undefined) {
            return true;
        }
        if (chainId.state !== "ready") {
            return undefined;
        }
        return expected === chainId();
    };

    return { signer, chainId, valid, refetch };
};

export type SignerNetworkCheck = ReturnType<typeof createSignerNetworkCheck>;
