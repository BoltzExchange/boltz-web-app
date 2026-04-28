const prependEnv = (
    envValue: string | undefined,
    defaults: readonly string[],
): readonly string[] =>
    envValue !== undefined && envValue !== ""
        ? [envValue, ...defaults]
        : defaults;

export const arbitrumRpcUrls = prependEnv(
    import.meta.env.VITE_ARBITRUM_RPC_ENDPOINT,
    ["https://arb1.arbitrum.io/rpc"],
);

export const avalancheRpcUrls = prependEnv(
    import.meta.env.VITE_AVALANCHE_RPC_ENDPOINT,
    [
        "https://api.avax.network/ext/bc/C/rpc",
        "https://avalanche-c-chain-rpc.publicnode.com",
    ],
);

export const baseRpcUrls = prependEnv(import.meta.env.VITE_BASE_RPC_ENDPOINT, [
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
]);

export const berachainRpcUrls = prependEnv(
    import.meta.env.VITE_BERACHAIN_RPC_ENDPOINT,
    ["https://rpc.berachain.com"],
);

export const confluxRpcUrls = prependEnv(
    import.meta.env.VITE_CONFLUX_RPC_ENDPOINT,
    ["https://evm.confluxrpc.com/"],
);

export const codexRpcUrls = prependEnv(
    import.meta.env.VITE_CODEX_RPC_ENDPOINT,
    ["https://rpc.codex.xyz"],
);

export const cornRpcUrls = prependEnv(import.meta.env.VITE_CORN_RPC_ENDPOINT, [
    "https://mainnet.corn-rpc.com",
]);

export const ethereumRpcUrls = prependEnv(
    import.meta.env.VITE_ETHEREUM_RPC_ENDPOINT,
    ["https://ethereum-rpc.publicnode.com"],
);

export const flareRpcUrls = prependEnv(
    import.meta.env.VITE_FLARE_RPC_ENDPOINT,
    ["https://rpc.ankr.com/flare", "https://flare-api.flare.network/ext/C/rpc"],
);

export const hederaRpcUrls = prependEnv(
    import.meta.env.VITE_HEDERA_RPC_ENDPOINT,
    ["https://mainnet.hashio.io/api", "https://295.rpc.thirdweb.com"],
);

export const hyperEvmRpcUrls = prependEnv(
    import.meta.env.VITE_HYPER_EVM_RPC_ENDPOINT,
    ["https://rpc.hyperliquid.xyz/evm"],
);

export const inkRpcUrls = prependEnv(import.meta.env.VITE_INK_RPC_ENDPOINT, [
    "https://rpc-gel.inkonchain.com",
]);

export const lineaRpcUrls = prependEnv(
    import.meta.env.VITE_LINEA_RPC_ENDPOINT,
    ["https://rpc.linea.build", "https://linea-rpc.publicnode.com"],
);

export const mantleRpcUrls = prependEnv(
    import.meta.env.VITE_MANTLE_RPC_ENDPOINT,
    ["https://rpc.mantle.xyz"],
);

export const megaEthRpcUrls = prependEnv(
    import.meta.env.VITE_MEGA_ETH_RPC_ENDPOINT,
    ["https://mainnet.megaeth.com/rpc"],
);

export const monadRpcUrls = prependEnv(
    import.meta.env.VITE_MONAD_RPC_ENDPOINT,
    ["https://rpc3.monad.xyz", "https://rpc-mainnet.monadinfra.com"],
);

export const morphRpcUrls = prependEnv(
    import.meta.env.VITE_MORPH_RPC_ENDPOINT,
    ["https://rpc.morph.network"],
);

export const optimismRpcUrls = prependEnv(
    import.meta.env.VITE_OPTIMISM_RPC_ENDPOINT,
    ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"],
);

export const plasmaRpcUrls = prependEnv(
    import.meta.env.VITE_PLASMA_RPC_ENDPOINT,
    ["https://rpc.plasma.to"],
);

export const plumeRpcUrls = prependEnv(
    import.meta.env.VITE_PLUME_RPC_ENDPOINT,
    ["https://rpc.plume.org"],
);

export const polygonRpcUrls = prependEnv(
    import.meta.env.VITE_POLYGON_RPC_ENDPOINT,
    [
        "https://polygon-bor-rpc.publicnode.com",
        "https://rpc-mainnet.matic.quiknode.pro",
    ],
);

// RSK mainnet supports both the new first-entry override
// (VITE_RSK_RPC_ENDPOINT) and the legacy append-as-fallback var
// (VITE_RSK_FALLBACK_ENDPOINT).
const rskFallback = import.meta.env.VITE_RSK_FALLBACK_ENDPOINT;
export const rskRpcUrls = prependEnv(
    import.meta.env.VITE_RSK_RPC_ENDPOINT,
    rskFallback !== undefined && rskFallback !== ""
        ? ["https://public-node.rsk.co", rskFallback]
        : ["https://public-node.rsk.co"],
);

export const rskTestnetRpcUrls = prependEnv(
    import.meta.env.VITE_RSK_TESTNET_RPC_ENDPOINT,
    ["https://public-node.testnet.rsk.co"],
);

export const seiRpcUrls = prependEnv(import.meta.env.VITE_SEI_RPC_ENDPOINT, [
    "https://sei.api.pocket.network",
    "https://evm-rpc.sei-apis.com",
]);

export const solanaRpcUrls = prependEnv(
    import.meta.env.VITE_SOLANA_RPC_ENDPOINT,
    ["https://api.mainnet.solana.com", "https://solana-rpc.publicnode.com"],
);

export const sonicRpcUrls = prependEnv(
    import.meta.env.VITE_SONIC_RPC_ENDPOINT,
    ["https://rpc.soniclabs.com", "https://sonic.api.pocket.network"],
);

export const stableRpcUrls = prependEnv(
    import.meta.env.VITE_STABLE_RPC_ENDPOINT,
    ["https://rpc.stable.xyz"],
);

export const tempoRpcUrls = prependEnv(
    import.meta.env.VITE_TEMPO_RPC_ENDPOINT,
    ["https://rpc.tempo.xyz"],
);

export const tronRpcUrls = prependEnv(import.meta.env.VITE_TRON_RPC_ENDPOINT, [
    "https://tron-rpc.publicnode.com",
    "https://api.trongrid.io",
]);

export const unichainRpcUrls = prependEnv(
    import.meta.env.VITE_UNICHAIN_RPC_ENDPOINT,
    ["https://mainnet.unichain.org", "https://unichain-rpc.publicnode.com"],
);

export const worldChainRpcUrls = prependEnv(
    import.meta.env.VITE_WORLD_CHAIN_RPC_ENDPOINT,
    [
        "https://worldchain-mainnet.g.alchemy.com/public",
        "https://480.rpc.thirdweb.com",
    ],
);

export const xdcRpcUrls = prependEnv(import.meta.env.VITE_XDC_RPC_ENDPOINT, [
    "https://rpc.xdc.org",
    "https://rpc.ankr.com/xdc",
]);

export const xlayerRpcUrls = prependEnv(
    import.meta.env.VITE_XLAYER_RPC_ENDPOINT,
    ["https://xlayerrpc.okx.com"],
);
