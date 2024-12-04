import Loader from "./Loader";

export default new Loader("WalletConnect", async () => {
    const [appKit, EthersAdapter] = await Promise.all([
        import("@reown/appkit"),
        (async () => {
            const ethersAdapter = await import("@reown/appkit-adapter-ethers");
            return ethersAdapter.EthersAdapter;
        })(),
    ]);

    return {
        appKit,
        EthersAdapter,
    };
});
