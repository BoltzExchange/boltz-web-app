import { createAssetProvider } from "boltz-swaps/evm";
import {
    erc20Abi,
    erc20SwapAbi,
    etherSwapAbi,
    routerAbi,
} from "boltz-swaps/generated/evm-abis";
import {
    type GetContractReturnType,
    type PublicClient,
    getAddress,
    getContract,
} from "viem";

import { requireRouterAddress, requireTokenConfig } from "../consts/Assets";
import erc20SwapAbiV5 from "../consts/abis/v5/ERC20Swap.json";
import etherSwapAbiV5 from "../consts/abis/v5/EtherSwap.json";
import type { ContractAddresses, Contracts } from "../utils/boltzClient";
import type { Signer } from "./Web3";

export type SignerClient = { public: PublicClient; wallet: Signer };
export type ReadOnlyClient = { public: PublicClient };

export type TokenContract = GetContractReturnType<
    typeof erc20Abi,
    SignerClient
>;
export type EtherSwapContract = GetContractReturnType<
    typeof etherSwapAbi,
    SignerClient | ReadOnlyClient
>;
export type Erc20SwapContract = GetContractReturnType<
    typeof erc20SwapAbi,
    SignerClient | ReadOnlyClient
>;
export type RouterContract = GetContractReturnType<
    typeof routerAbi,
    SignerClient
>;

export const createTokenContract = (
    asset: string,
    signer: Signer,
): TokenContract => {
    const tokenConfig = requireTokenConfig(asset);
    return getContract({
        address: getAddress(tokenConfig.address),
        abi: erc20Abi,
        client: { public: createAssetProvider(asset), wallet: signer },
    });
};

export const createRouterContract = (
    asset: string,
    signer: Signer,
): RouterContract => {
    const routerAddress = requireRouterAddress(asset);
    return getContract({
        address: getAddress(routerAddress),
        abi: routerAbi,
        client: { public: createAssetProvider(asset), wallet: signer },
    });
};

// EtherSwap and ERC20Swap v6 added `claimAddress` to the indexed topics

export const resolveEtherSwapAbi = (version: number) =>
    (version <= 5 ? etherSwapAbiV5 : etherSwapAbi) as typeof etherSwapAbi;

export const resolveErc20SwapAbi = (version: number) =>
    (version <= 5 ? erc20SwapAbiV5 : erc20SwapAbi) as typeof erc20SwapAbi;

export const resolveSwapContractVersion = (
    contracts: Contracts,
    contractType: keyof ContractAddresses,
): number => {
    const address = contracts.swapContracts[contractType];
    return Number(
        Object.keys(contracts.supportedContracts).find(
            (key) =>
                contracts.supportedContracts[key][contractType] === address,
        ) ?? 5,
    );
};
