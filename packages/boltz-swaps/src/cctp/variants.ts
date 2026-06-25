import { getExplorerId } from "../evm/explorer.ts";
import { type ChainKey, type ChainMeta, chains } from "../networks.ts";
import {
    type Asset,
    AssetKind,
    BridgeKind,
    CctpTransferMode,
    NetworkTransport,
} from "../types.ts";
import {
    evmMessageTransmitterV2,
    evmTokenMessengerV2,
    solanaMessageTransmitterV2,
    solanaTokenMessengerMinterV2,
} from "./protocol.ts";

export type CctpVariant = {
    asset: string;
    chain: ChainKey;
    // Circle's domain id (https://developers.circle.com/cctp/evm-smart-contracts).
    domain: number;
    tokenAddress: string;
    canSend?: boolean;
    // Overrides `evmTokenMessengerV2` / `solanaTokenMessengerMinterV2`. Only
    // needed for chains where Circle deployed a distinct contract (EDGE today).
    tokenMessengerOverride?: string;
    messageTransmitterOverride?: string;
};

// USDC contract addresses sourced from Circle's official list:
// https://developers.circle.com/stablecoins/usdc-contract-addresses
export const cctpVariants = [
    {
        asset: "USDC-BASE",
        chain: "BASE",
        domain: 6,
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    {
        asset: "USDC-ETH",
        chain: "ETH",
        domain: 0,
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
        asset: "USDC-AVAX",
        chain: "AVAX",
        domain: 1,
        tokenAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    },
    {
        asset: "USDC-OP",
        chain: "OP",
        domain: 2,
        tokenAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
    {
        asset: "USDC-POL",
        chain: "POL",
        domain: 7,
        tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    },
    {
        asset: "USDC-UNI",
        chain: "UNI",
        domain: 10,
        tokenAddress: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    },
    {
        asset: "USDC-LINEA",
        chain: "LINEA",
        domain: 11,
        tokenAddress: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    },
    {
        asset: "USDC-CODEX",
        chain: "CODEX",
        domain: 12,
        tokenAddress: "0xd996633a415985DBd7D6D12f4A4343E31f5037cf",
    },
    {
        asset: "USDC-SONIC",
        chain: "SONIC",
        domain: 13,
        tokenAddress: "0x29219dd400f2Bf60E5a23d13be72b486d4038894",
    },
    {
        asset: "USDC-WORLD",
        chain: "WORLD",
        domain: 14,
        tokenAddress: "0x79A02482A880bCe3F13E09da970dC34dB4cD24D1",
    },
    {
        asset: "USDC-MON",
        chain: "MON",
        domain: 15,
        tokenAddress: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    },
    {
        asset: "USDC-SEI",
        chain: "SEI",
        domain: 16,
        tokenAddress: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392",
    },
    {
        asset: "USDC-XDC",
        chain: "XDC",
        domain: 18,
        tokenAddress: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1",
    },
    {
        asset: "USDC-INK",
        chain: "INK",
        domain: 21,
        tokenAddress: "0x2D270e6886d130D724215A266106e6832161EAEd",
    },
    {
        asset: "USDC-PLUME",
        chain: "PLUME",
        domain: 22,
        tokenAddress: "0x222365EF19F7947e5484218551B56bb3965Aa7aF",
    },
    {
        asset: "USDC-SOL",
        chain: "SOL",
        domain: 5,
        tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    },
] as const satisfies readonly CctpVariant[];

export type CctpVariantAsset = (typeof cctpVariants)[number]["asset"];

export type CctpVariantOverrides = {
    rpcUrls?: readonly string[];
    canSend?: boolean;
};

export const createCctpVariantAsset = (
    variant: CctpVariant,
    overrides: CctpVariantOverrides = {},
): Asset => {
    const chain: ChainMeta = chains[variant.chain];
    const isSolana = chain.transport === NetworkTransport.Solana;

    const network: NonNullable<Asset["network"]> = {
        symbol: chain.symbol,
        gasToken: chain.gasToken,
        chainName: chain.chainName,
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
        canSend: overrides.canSend ?? variant.canSend ?? true,
        blockExplorerUrl: {
            id: getExplorerId(chain.transport),
            normal: chain.explorerUrl,
        },
        network,
        bridge: {
            kind: BridgeKind.Cctp,
            canonicalAsset: "USDC",
            cctp: {
                domain: variant.domain,
                tokenMessenger:
                    variant.tokenMessengerOverride ??
                    (isSolana
                        ? solanaTokenMessengerMinterV2
                        : evmTokenMessengerV2),
                messageTransmitter:
                    variant.messageTransmitterOverride ??
                    (isSolana
                        ? solanaMessageTransmitterV2
                        : evmMessageTransmitterV2),
                transferMode: CctpTransferMode.Fast,
            },
        },
        token: {
            address: variant.tokenAddress,
            decimals: 6,
        },
    };
};
