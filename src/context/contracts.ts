import {
    type GetContractReturnType,
    type PublicClient,
    getAddress,
    getContract,
} from "viem";

import { requireRouterAddress, requireTokenConfig } from "../consts/Assets";
import type { erc20SwapAbi, etherSwapAbi } from "../generated/evm-abis";
import { erc20Abi, routerAbi } from "../generated/evm-abis";
import { createAssetProvider } from "../utils/provider";
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
