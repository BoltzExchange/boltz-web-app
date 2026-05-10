import Loader from "boltz-swaps/lazy";

export default new Loader("WalletConnect", async () => {
    const [
        appKit,
        WagmiAdapter,
        SolanaAdapter,
        TronAdapter,
        MetaMaskAdapter,
        TronLinkAdapter,
        networks,
    ] = await Promise.all([
        import("@reown/appkit"),
        (async () => {
            const wagmiAdapter = await import("@reown/appkit-adapter-wagmi");
            return wagmiAdapter.WagmiAdapter;
        })(),
        (async () => {
            const solanaAdapter = await import("@reown/appkit-adapter-solana");
            return solanaAdapter.SolanaAdapter;
        })(),
        (async () => {
            const tronAdapter = await import("@reown/appkit-adapter-tron");
            return tronAdapter.TronAdapter;
        })(),
        (async () => {
            const metaMaskAdapter =
                await import("@tronweb3/tronwallet-adapter-metamask-tron");
            return metaMaskAdapter.MetaMaskAdapter;
        })(),
        (async () => {
            const tronLinkAdapter =
                await import("@tronweb3/tronwallet-adapter-tronlink");
            return tronLinkAdapter.TronLinkAdapter;
        })(),
        import("@reown/appkit/networks"),
    ]);

    return {
        appKit,
        WagmiAdapter,
        SolanaAdapter,
        TronAdapter,
        MetaMaskAdapter,
        TronLinkAdapter,
        solana: networks.solana,
        tronMainnet: networks.tronMainnet,
    };
});
