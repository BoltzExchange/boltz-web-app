const derivationPaths = {
    RSK: "44'/137'/0'/0/0",
    Ethereum: "44'/60'/0'/0/0",
};

interface HardwareSigner {
    setDerivationPath(path: string): void;
}

export { HardwareSigner, derivationPaths };
