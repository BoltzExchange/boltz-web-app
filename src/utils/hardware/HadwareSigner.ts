export const derivationPaths = {
    Ethereum: "44'/60'/0'/0/0",
};

export const derivationPathsMainnet = {
    RSK: "44'/137'/0'/0/0",
};

export const derivationPathsTestnet = {
    ["RSK Testnet"]: "44'/37310'/0'/0/0",
};

export interface HardwareSigner {
    setDerivationPath(path: string): void;
}
