import { type Address, getAddress, getContract } from "viem";

import { getContracts } from "../client.ts";
import { requireChainId } from "../config.ts";
import type { Signer } from "../interfaces/signer.ts";
import type { ContractAddresses, Contracts } from "../types.ts";
import { resolveErc20SwapAbi, resolveEtherSwapAbi } from "./abis/index.ts";
import {
    type Erc20SwapContract,
    type EtherSwapContract,
    resolveSwapContractVersion,
} from "./contracts.ts";
import { createAssetProvider } from "./provider.ts";

export type SwapContracts = {
    etherSwap: EtherSwapContract;
    erc20Swap: Erc20SwapContract;
};

const findContractsForAsset = (
    all: Record<string, Contracts>,
    asset: string,
): Contracts => {
    const chainId = requireChainId(asset);
    const match = Object.values(all).find(
        (chain) => chain.network.chainId === chainId,
    );
    if (match === undefined) {
        throw new Error(
            `no swap contracts available for asset ${asset} (chainId ${chainId})`,
        );
    }
    return match;
};

const requireSwapAddress = (
    contracts: Contracts,
    contractType: keyof ContractAddresses,
): Address => {
    const address = contracts.swapContracts[contractType];
    if (address === undefined) {
        throw new Error(`missing ${contractType} swap contract address`);
    }
    return getAddress(address);
};

export const buildSwapContractsForAsset = async (
    asset: string,
    signer: Signer,
): Promise<SwapContracts> => {
    const contracts = findContractsForAsset(await getContracts(), asset);
    const client = { public: createAssetProvider(asset), wallet: signer };

    return {
        etherSwap: getContract({
            address: requireSwapAddress(contracts, "EtherSwap"),
            abi: resolveEtherSwapAbi(
                resolveSwapContractVersion(contracts, "EtherSwap"),
            ),
            client,
        }),
        erc20Swap: getContract({
            address: requireSwapAddress(contracts, "ERC20Swap"),
            abi: resolveErc20SwapAbi(
                resolveSwapContractVersion(contracts, "ERC20Swap"),
            ),
            client,
        }),
    };
};
