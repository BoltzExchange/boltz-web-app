import Loader from "./Loader";

export default new Loader("WalletConnect", async () => {
    const [appKit, EthersAdapter, SolanaAdapter, TronAdapter, networks] =
        await Promise.all([
            import("@reown/appkit"),
            (async () => {
                const ethersAdapter =
                    await import("@reown/appkit-adapter-ethers");
                return ethersAdapter.EthersAdapter;
            })(),
            (async () => {
                const solanaAdapter =
                    await import("@reown/appkit-adapter-solana");
                return solanaAdapter.SolanaAdapter;
            })(),
            (async () => {
                const tronAdapter = await import("@reown/appkit-adapter-tron");
                return tronAdapter.TronAdapter;
            })(),
            import("@reown/appkit/networks"),
        ]);

    return {
        appKit,
        EthersAdapter,
        SolanaAdapter,
        TronAdapter,
        solana: networks.solana,
        tronMainnet: networks.tronMainnet,
    };
});
