import Loader from "./Loader";

export default new Loader("Solana CCTP", async () => {
    const [solanaKit, web3, generated] = await Promise.all([
        import("@solana/kit"),
        import("@solana/web3.js"),
        import("../generated/solana-cctp-token-messenger-minter/src/generated"),
    ]);

    return {
        generated,
        solanaKit,
        web3,
    };
});
