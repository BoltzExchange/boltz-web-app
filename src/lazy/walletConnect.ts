import Loader from "./Loader";

export default new Loader("WalletConnect", async () => {
    const [appKit, WagmiAdapter] = await Promise.all([
        import("@reown/appkit"),
        (async () => {
            const wagmiAdapter = await import("@reown/appkit-adapter-wagmi");
            return wagmiAdapter.WagmiAdapter;
        })(),
    ]);

    return {
        appKit,
        WagmiAdapter,
    };
});
