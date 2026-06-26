import { getExplorerId } from "../evm/explorer.ts";
import { type ChainKey, type ChainMeta, chains } from "../networks.ts";
import {
    type Asset,
    AssetKind,
    BridgeKind,
    NetworkTransport,
    Usdt0Kind,
} from "../types.ts";

export type Usdt0Variant = {
    asset: string;
    chain: ChainKey;
    tokenAddress: string;
    canSend: boolean;
    disabled?: boolean;
    mesh?: Usdt0Kind;
    // Address used to simulate bridge quote transactions when no wallet is
    // connected. Only required on Solana.
    oftQuotePayer?: string;
};

export const usdt0Variants = [
    {
        asset: "USDT0-ETH",
        chain: "ETH",
        tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        canSend: true,
    },
    {
        asset: "USDT0-BERA",
        chain: "BERA",
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        canSend: true,
    },
    {
        asset: "USDT0-CFX",
        chain: "CFX",
        tokenAddress: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
        canSend: false,
    },
    {
        asset: "USDT0-FLR",
        chain: "FLR",
        tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
        canSend: false,
    },
    {
        asset: "USDT0-HYPE",
        chain: "HYPE",
        tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
        canSend: false,
    },
    {
        asset: "USDT0-HBAR",
        chain: "HBAR",
        tokenAddress: "0x00000000000000000000000000000000009Ce723",
        canSend: true,
    },
    {
        asset: "USDT0-INK",
        chain: "INK",
        tokenAddress: "0x0200C29006150606B650577BBE7B6248F58470c1",
        canSend: true,
    },
    {
        asset: "USDT0-MNT",
        chain: "MNT",
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        canSend: false,
    },
    {
        asset: "USDT0-MEGAETH",
        chain: "MEGAETH",
        tokenAddress: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
        canSend: false,
    },
    {
        asset: "USDT0-MON",
        chain: "MON",
        tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
        canSend: false,
    },
    {
        asset: "USDT0-MORPH",
        chain: "MORPH",
        tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
        canSend: false,
    },
    {
        asset: "USDT0-OP",
        chain: "OP",
        tokenAddress: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
        canSend: false,
    },
    {
        asset: "USDT0-PLASMA",
        chain: "PLASMA",
        tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
        canSend: false,
    },
    {
        asset: "USDT0-POL",
        chain: "POL",
        tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        canSend: true,
    },
    {
        asset: "USDT0-RBTC",
        chain: "RBTC",
        tokenAddress: "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
        canSend: false,
    },
    {
        asset: "USDT0-SEI",
        chain: "SEI",
        tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
        canSend: false,
    },
    {
        asset: "USDT0-STABLE",
        chain: "STABLE",
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        canSend: false,
    },
    {
        asset: "USDT0-UNI",
        chain: "UNI",
        tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
        canSend: true,
    },
    {
        asset: "USDT0-SOL",
        chain: "SOL",
        tokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        canSend: true,
        mesh: Usdt0Kind.Legacy,
        oftQuotePayer: "EzTybRqGouGB4vKin67HFYgLsVkzE6A1YUq26uKyTvPN",
    },
    {
        asset: "USDT0-TRON",
        chain: "TRON",
        tokenAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        canSend: true,
        mesh: Usdt0Kind.Legacy,
    },
    {
        asset: "USDT0-XLAYER",
        chain: "XLAYER",
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        canSend: false,
    },
    {
        asset: "USDT0-TEMPO",
        chain: "TEMPO",
        tokenAddress: "0x20C00000000000000000000014f22CA97301EB73",
        canSend: false,
    },
] as const satisfies readonly Usdt0Variant[];

export type Usdt0VariantAsset = (typeof usdt0Variants)[number]["asset"];

export type Usdt0VariantOverrides = {
    rpcUrls?: readonly string[];
    canSend?: boolean;
};

export const createUsdt0VariantAsset = (
    variant: Usdt0Variant,
    overrides: Usdt0VariantOverrides = {},
): Asset => {
    const chain: ChainMeta = chains[variant.chain];
    const mesh = variant.mesh ?? Usdt0Kind.Native;

    const network: NonNullable<Asset["network"]> = {
        chainName: chain.chainName,
        symbol: chain.symbol,
        gasToken: chain.gasToken,
        transport: chain.transport,
        rpcUrls: overrides.rpcUrls ?? chain.defaultRpcUrls,
        nativeCurrency: {
            name: chain.gasToken,
            symbol: chain.gasToken,
            decimals: chain.nativeDecimals,
            minGas: chain.minGas,
        },
    };
    if (chain.transport === NetworkTransport.Evm) {
        network.chainId = chain.chainId;
    }

    return {
        type: AssetKind.ERC20,
        canSend: overrides.canSend ?? variant.canSend,
        disabled: variant.disabled,
        blockExplorerUrl: {
            id: getExplorerId(chain.transport),
            normal: chain.explorerUrl,
        },
        network,
        token: {
            address: variant.tokenAddress,
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Oft,
            canonicalAsset: "USDT0",
            oft: {
                mesh,
                quotePayer: variant.oftQuotePayer,
            },
        },
    };
};
