import { createConfig, http } from "@wagmi/core";
import { EtherSwapAbi } from "src/context/Web3";
import { type Contracts } from "src/utils/boltzClient";
import { type Address, type Chain, custom } from "viem";

import { config } from "../config";

export function createViemChains() {
    const chains: Chain[] = [];

    for (const [, value] of Object.entries(config.assets)) {
        if (value.network) {
            chains.push({
                id: value.network.chainId,
                name: value.network.chainName,
                nativeCurrency: value.network.nativeCurrency,
                rpcUrls: {
                    default: { http: value.network.rpcUrls },
                },
                blockExplorers: value.blockExplorerUrl
                    ? {
                          default: {
                              name: "Explorer",
                              url: value.blockExplorerUrl.normal,
                          },
                      }
                    : undefined,
                // contracts: value.contracts,
            });
        }
    }

    return chains;
}

export const networks = createViemChains();

export const transports = Object.fromEntries(
    networks.map((item) => [
        item.id,
        http(
            item.rpcUrls.default.http?.[0] ||
                "https://public-node.testnet.rsk.co",
        ),
    ]),
);

export const walletTransport = custom(window.ethereum);

export const wagmiConfig = createConfig({
    chains: networks as [Chain, ...Chain[]],
    transports,
    ssr: false,
});

export const getWagmiEtherSwapContractConfig = (
    getContracts: () => Contracts,
) => {
    const address = getContracts().swapContracts.EtherSwap as Address;
    return {
        address,
        abi: EtherSwapAbi,
    } as const;
};
