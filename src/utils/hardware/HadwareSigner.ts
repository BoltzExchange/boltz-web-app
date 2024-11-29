import type { JsonRpcProvider } from "ethers";

export const derivationPaths = {
    Ethereum: "44'/60'/0'/0",
};

export const derivationPathsMainnet = {
    RSK: "44'/137'/0'",
};

export const derivationPathsTestnet = {
    ["RSK Testnet"]: "44'/37310'/0'",
};

export type DerivedAddress = {
    path: string;
    address: string;
};

export interface HardwareSigner {
    getProvider(): JsonRpcProvider;

    deriveAddresses(
        basePath: string,
        offset: number,
        limit: number,
    ): Promise<DerivedAddress[]>;

    getDerivationPath(): string;
    setDerivationPath(path: string): void;
}
