import type * as lzSolanaUmiNs from "@layerzerolabs/lz-solana-sdk-v2/umi";
import type * as mplToolboxNs from "@metaplex-foundation/mpl-toolbox";
import type * as umiNs from "@metaplex-foundation/umi";
import type * as umiBundleDefaultsNs from "@metaplex-foundation/umi-bundle-defaults";
import type * as umiWalletAdaptersNs from "@metaplex-foundation/umi-signer-wallet-adapters";
import type * as solanaKitNs from "@solana/kit";
import type * as splTokenNs from "@solana/spl-token";
import type * as web3Ns from "@solana/web3.js";

import type * as solanaCctpGeneratedNs from "../generated/solana-cctp-token-messenger-minter/src/generated/index.ts";
import type * as solanaOftGeneratedNs from "../generated/solana-oft/src/generated/index.ts";
import Loader from "../lazy.ts";

type SolanaModules = {
    web3: typeof web3Ns;
    splToken: typeof splTokenNs;
};

type SolanaCctpModules = {
    generated: typeof solanaCctpGeneratedNs;
    solanaKit: typeof solanaKitNs;
    web3: typeof web3Ns;
};

type SolanaOftModules = {
    generated: typeof solanaOftGeneratedNs;
    lzSolanaUmi: typeof lzSolanaUmiNs;
    mplToolbox: typeof mplToolboxNs;
    solanaKit: typeof solanaKitNs;
    splToken: typeof splTokenNs;
    umi: typeof umiNs;
    umiBundleDefaults: typeof umiBundleDefaultsNs;
    umiWalletAdapters: typeof umiWalletAdaptersNs;
    web3: typeof web3Ns;
};

export const solana: Loader<SolanaModules> = new Loader(
    "Solana",
    async (): Promise<SolanaModules> => {
        const web3 = await import("@solana/web3.js");
        const splToken = await import("@solana/spl-token");

        return { web3, splToken };
    },
);

export const solanaCctp: Loader<SolanaCctpModules> = new Loader(
    "Solana CCTP",
    async (): Promise<SolanaCctpModules> => {
        const solanaKit = await import("@solana/kit");
        const web3 = await import("@solana/web3.js");
        const generated =
            await import("../generated/solana-cctp-token-messenger-minter/src/generated/index.ts");

        return {
            generated,
            solanaKit,
            web3,
        };
    },
);

export const solanaOft: Loader<SolanaOftModules> = new Loader(
    "Solana OFT",
    async (): Promise<SolanaOftModules> => {
        const lzSolanaUmi = await import("@layerzerolabs/lz-solana-sdk-v2/umi");
        const mplToolbox = await import("@metaplex-foundation/mpl-toolbox");
        const umi = await import("@metaplex-foundation/umi");
        const umiBundleDefaults =
            await import("@metaplex-foundation/umi-bundle-defaults");
        const umiWalletAdapters =
            await import("@metaplex-foundation/umi-signer-wallet-adapters");
        const solanaKit = await import("@solana/kit");
        const splToken = await import("@solana/spl-token");
        const web3 = await import("@solana/web3.js");
        const generated =
            await import("../generated/solana-oft/src/generated/index.ts");

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
    },
);
