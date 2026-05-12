import { createAssetProvider } from "boltz-swaps/evm";
import { getAddress, getContract, parseAbi } from "viem";

import { config } from "../config";
import { RBTC } from "../consts/Assets";
import type { Signer } from "../context/Web3";

export const BoltzSmartWalletFactoryAbi = parseAbi([
    "function nonce(address from) view returns (uint256)",
    "function getSmartWalletAddress(address owner, address recoverer, uint256 index) view returns (address)",
]);

export const ForwarderAbi = parseAbi([
    "function nonce() view returns (uint256)",
]);

const requireRbtcContractAddress = (
    name: "smartWalletFactory" | "deployVerifier",
) => {
    const address = config.assets?.[RBTC]?.contracts?.[name];
    if (address === undefined) {
        throw new Error(`missing RBTC ${name} contract`);
    }

    return getAddress(address);
};

export const getRifDeployVerifierAddress = () =>
    requireRbtcContractAddress("deployVerifier");

const getSmartWalletFactoryAddress = () =>
    requireRbtcContractAddress("smartWalletFactory");

export const getSmartWalletFactory = (signer: Signer) =>
    getContract({
        address: getSmartWalletFactoryAddress(),
        abi: BoltzSmartWalletFactoryAbi,
        client: { public: createAssetProvider(RBTC), wallet: signer },
    });

export const getForwarder = (signer: Signer, forwarder: string) =>
    getContract({
        address: getAddress(forwarder),
        abi: ForwarderAbi,
        client: { public: createAssetProvider(RBTC), wallet: signer },
    });
