import { getCachedValue } from "../cache.ts";
import { getBoltzSwapsConfig, getBridgeMesh } from "../config.ts";
import { formatError } from "../errors.ts";
import { getLogger } from "../logger.ts";
import { Usdt0Kind } from "../types.ts";
import type { OftRoute } from "./types.ts";

export type OftContract = {
    name: string;
    address: string;
    explorer: string;
};

type OftChain = {
    name: string;
    chainId?: number;
    lzEid?: string;
    isSource?: boolean;
    contracts: OftContract[];
};

type OftTokenConfig = {
    native: OftChain[];
    legacyMesh: OftChain[];
};

type OftRegistry = Record<string, OftTokenConfig>;

export const defaultOftName = "usdt0";
const primaryOftContractNames = ["OFT", "OFT Adapter", "OFT Program"] as const;
const oftPrefix = "oft:";
const deploymentsKey = "deployments";

export const formatRoute = (route: OftRoute) =>
    `${route.sourceAsset} -> ${route.destinationAsset}`;

const requireOftDeploymentsUrl = (): string => {
    const url = getBoltzSwapsConfig().oftDeploymentsUrl;
    if (url === undefined || url === "") {
        throw new Error("missing OFT deployments URL");
    }
    return url;
};

const fetchOftDeployments = async (): Promise<OftRegistry> => {
    const response = await fetch(requireOftDeploymentsUrl());
    if (!response.ok) {
        throw new Error(
            `Failed to fetch OFT deployments: ${response.status} ${response.statusText}`,
        );
    }

    const data: unknown = await response.json();
    return data as OftRegistry;
};

export const getOftDeployments = (): Promise<OftRegistry> =>
    getCachedValue(oftPrefix, deploymentsKey, async () => {
        try {
            return await fetchOftDeployments();
        } catch (error) {
            getLogger().error(
                "Failed to fetch OFT deployments",
                formatError(error),
            );
            throw error;
        }
    });

export const getOftChain = async (
    asset: string,
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftChain | undefined> => {
    const deployments = await getOftDeployments();
    const tokenConfig = deployments[oftName.toLowerCase()];
    if (tokenConfig === undefined) {
        return undefined;
    }

    const assetConfig = getBoltzSwapsConfig().assets?.[asset];
    const meshKind = getBridgeMesh(route.sourceAsset, route.destinationAsset);
    const registryKey: keyof OftTokenConfig =
        meshKind === Usdt0Kind.Legacy ? "legacyMesh" : "native";

    const chains = tokenConfig[registryKey];
    const assetChainId = assetConfig?.network?.chainId;
    const assetChainName = assetConfig?.network?.chainName?.toLowerCase();
    return chains.find((chain) =>
        chain.chainId !== undefined
            ? assetChainId !== undefined && chain.chainId === assetChainId
            : assetChainName !== undefined &&
              chain.name.toLowerCase() === assetChainName,
    );
};

export const findOftChainContract = (
    chain: Pick<OftChain, "contracts"> | undefined,
    names: readonly string[],
): OftContract | undefined => {
    return names
        .map((name) =>
            chain?.contracts.find((contract) => contract.name === name),
        )
        .find((contract): contract is OftContract => contract !== undefined);
};

export const getOftContract = async (
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftContract> => {
    const chain = await getOftChain(route.sourceAsset, route, oftName);
    const contract = findOftChainContract(chain, primaryOftContractNames);
    if (contract === undefined) {
        throw new Error(
            `Missing OFT contract for route ${formatRoute(route)} and OFT ${oftName}`,
        );
    }

    return contract;
};
