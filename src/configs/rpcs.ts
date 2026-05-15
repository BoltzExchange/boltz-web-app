import { type ChainKey, chains } from "boltz-swaps/chains";

const prependEnv = (
    envValue: string | undefined,
    defaults: readonly string[],
): readonly string[] =>
    envValue !== undefined && envValue !== ""
        ? [envValue, ...defaults]
        : defaults;

// Mainnet RSK supports both the new first-entry override
// (VITE_RSK_RPC_ENDPOINT) and the legacy append-as-fallback var
// (VITE_RSK_FALLBACK_ENDPOINT).
const buildRskRpcUrls = (): readonly string[] => {
    const fallback = import.meta.env.VITE_RSK_FALLBACK_ENDPOINT;
    const withFallback =
        fallback !== undefined && fallback !== ""
            ? [...chains.RBTC.defaultRpcUrls, fallback]
            : chains.RBTC.defaultRpcUrls;
    return prependEnv(import.meta.env.VITE_RSK_RPC_ENDPOINT, withFallback);
};

export const envRpcUrls: Partial<Record<ChainKey, readonly string[]>> = {
    ARB: prependEnv(
        import.meta.env.VITE_ARBITRUM_RPC_ENDPOINT,
        chains.ARB.defaultRpcUrls,
    ),
    AVAX: prependEnv(
        import.meta.env.VITE_AVALANCHE_RPC_ENDPOINT,
        chains.AVAX.defaultRpcUrls,
    ),
    BASE: prependEnv(
        import.meta.env.VITE_BASE_RPC_ENDPOINT,
        chains.BASE.defaultRpcUrls,
    ),
    BERA: prependEnv(
        import.meta.env.VITE_BERACHAIN_RPC_ENDPOINT,
        chains.BERA.defaultRpcUrls,
    ),
    CFX: prependEnv(
        import.meta.env.VITE_CONFLUX_RPC_ENDPOINT,
        chains.CFX.defaultRpcUrls,
    ),
    CODEX: prependEnv(
        import.meta.env.VITE_CODEX_RPC_ENDPOINT,
        chains.CODEX.defaultRpcUrls,
    ),
    ETH: prependEnv(
        import.meta.env.VITE_ETHEREUM_RPC_ENDPOINT,
        chains.ETH.defaultRpcUrls,
    ),
    FLR: prependEnv(
        import.meta.env.VITE_FLARE_RPC_ENDPOINT,
        chains.FLR.defaultRpcUrls,
    ),
    HBAR: prependEnv(
        import.meta.env.VITE_HEDERA_RPC_ENDPOINT,
        chains.HBAR.defaultRpcUrls,
    ),
    HYPE: prependEnv(
        import.meta.env.VITE_HYPER_EVM_RPC_ENDPOINT,
        chains.HYPE.defaultRpcUrls,
    ),
    INK: prependEnv(
        import.meta.env.VITE_INK_RPC_ENDPOINT,
        chains.INK.defaultRpcUrls,
    ),
    LINEA: prependEnv(
        import.meta.env.VITE_LINEA_RPC_ENDPOINT,
        chains.LINEA.defaultRpcUrls,
    ),
    MEGAETH: prependEnv(
        import.meta.env.VITE_MEGA_ETH_RPC_ENDPOINT,
        chains.MEGAETH.defaultRpcUrls,
    ),
    MNT: prependEnv(
        import.meta.env.VITE_MANTLE_RPC_ENDPOINT,
        chains.MNT.defaultRpcUrls,
    ),
    MON: prependEnv(
        import.meta.env.VITE_MONAD_RPC_ENDPOINT,
        chains.MON.defaultRpcUrls,
    ),
    MORPH: prependEnv(
        import.meta.env.VITE_MORPH_RPC_ENDPOINT,
        chains.MORPH.defaultRpcUrls,
    ),
    OP: prependEnv(
        import.meta.env.VITE_OPTIMISM_RPC_ENDPOINT,
        chains.OP.defaultRpcUrls,
    ),
    PLASMA: prependEnv(
        import.meta.env.VITE_PLASMA_RPC_ENDPOINT,
        chains.PLASMA.defaultRpcUrls,
    ),
    PLUME: prependEnv(
        import.meta.env.VITE_PLUME_RPC_ENDPOINT,
        chains.PLUME.defaultRpcUrls,
    ),
    POL: prependEnv(
        import.meta.env.VITE_POLYGON_RPC_ENDPOINT,
        chains.POL.defaultRpcUrls,
    ),
    RBTC: buildRskRpcUrls(),
    SEI: prependEnv(
        import.meta.env.VITE_SEI_RPC_ENDPOINT,
        chains.SEI.defaultRpcUrls,
    ),
    SOL: prependEnv(
        import.meta.env.VITE_SOLANA_RPC_ENDPOINT,
        chains.SOL.defaultRpcUrls,
    ),
    SONIC: prependEnv(
        import.meta.env.VITE_SONIC_RPC_ENDPOINT,
        chains.SONIC.defaultRpcUrls,
    ),
    STABLE: prependEnv(
        import.meta.env.VITE_STABLE_RPC_ENDPOINT,
        chains.STABLE.defaultRpcUrls,
    ),
    TEMPO: prependEnv(
        import.meta.env.VITE_TEMPO_RPC_ENDPOINT,
        chains.TEMPO.defaultRpcUrls,
    ),
    TRON: prependEnv(
        import.meta.env.VITE_TRON_RPC_ENDPOINT,
        chains.TRON.defaultRpcUrls,
    ),
    UNI: prependEnv(
        import.meta.env.VITE_UNICHAIN_RPC_ENDPOINT,
        chains.UNI.defaultRpcUrls,
    ),
    WORLD: prependEnv(
        import.meta.env.VITE_WORLD_CHAIN_RPC_ENDPOINT,
        chains.WORLD.defaultRpcUrls,
    ),
    XDC: prependEnv(
        import.meta.env.VITE_XDC_RPC_ENDPOINT,
        chains.XDC.defaultRpcUrls,
    ),
    XLAYER: prependEnv(
        import.meta.env.VITE_XLAYER_RPC_ENDPOINT,
        chains.XLAYER.defaultRpcUrls,
    ),
};
