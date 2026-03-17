import { config } from "../../config";
import { type Provider } from "../provider";

export const derivationPaths = {
    Ethereum: "44'/60'/0'/0",
};

export const derivationPathsMainnet = {
    Rootstock: "44'/137'/0'/0",
};

export const derivationPathsTestnet = {
    ["Rootstock Testnet"]: "44'/37310'/0'/0",
};

export const getNetworkRpcUrls = (asset: string): string[] => {
    const rpcUrls = config.assets?.[asset]?.network?.rpcUrls;

    if (rpcUrls === undefined) {
        throw new Error(`missing network config for asset: ${asset}`);
    }

    return rpcUrls;
};

export const getDefaultNetworkAsset = (): string => {
    const asset = Object.entries(config.assets ?? {}).find(
        ([, assetConfig]) => assetConfig.network?.rpcUrls !== undefined,
    )?.[0];

    if (asset === undefined) {
        throw new Error("no EVM asset config available for hardware signer");
    }

    return asset;
};

export type DerivedAddress = {
    path: string;
    address: string;
};

export interface HardwareSigner {
    getProvider(): Provider;
    setNetworkAsset(asset: string): void;

    deriveAddresses(
        basePath: string,
        offset: number,
        limit: number,
    ): Promise<DerivedAddress[]>;

    getDerivationPath(): string;
    setDerivationPath(path: string): void;
}
