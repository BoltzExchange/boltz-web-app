import Loader from "./Loader";

export default new Loader("Solana OFT", async () => {
    const [
        lzSolanaUmi,
        mplToolbox,
        umi,
        umiBundleDefaults,
        umiWalletAdapters,
        solanaKit,
        splToken,
        web3,
        generated,
    ] = await Promise.all([
        import("@layerzerolabs/lz-solana-sdk-v2/umi"),
        import("@metaplex-foundation/mpl-toolbox"),
        import("@metaplex-foundation/umi"),
        import("@metaplex-foundation/umi-bundle-defaults"),
        import("@metaplex-foundation/umi-signer-wallet-adapters"),
        import("@solana/kit"),
        import("@solana/spl-token"),
        import("@solana/web3.js"),
        import("../generated/solana-oft/src/generated"),
    ]);

    return {
        generated,
        lzSolanaUmi,
        mplToolbox,
        solanaKit,
        splToken,
        umi,
        umiBundleDefaults,
        umiWalletAdapters,
        web3,
    };
});
