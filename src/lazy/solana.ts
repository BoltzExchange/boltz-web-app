import Loader from "./Loader";

export default new Loader("Solana", async () => {
    const [web3, splToken] = await Promise.all([
        import("@solana/web3.js"),
        import("@solana/spl-token"),
    ]);

    return {
        PublicKey: web3.PublicKey,
        getAssociatedTokenAddressSync: splToken.getAssociatedTokenAddressSync,
    };
});
