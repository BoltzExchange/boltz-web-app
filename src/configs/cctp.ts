import type { Asset } from "src/configs/base";
import {
    BridgeKind,
    CctpTransferMode,
    Explorer,
    NetworkTransport,
} from "src/configs/base";
import {
    avalancheExplorerUrl,
    baseExplorerUrl,
    codexExplorerUrl,
    ethereumExplorerUrl,
    inkExplorerUrl,
    lineaExplorerUrl,
    monadExplorerUrl,
    optimismExplorerUrl,
    plumeExplorerUrl,
    polygonExplorerUrl,
    seiExplorerUrl,
    sonicExplorerUrl,
    unichainExplorerUrl,
    worldChainExplorerUrl,
    xdcExplorerUrl,
} from "src/configs/explorers";
import {
    avalancheRpcUrls,
    baseRpcUrls,
    codexRpcUrls,
    ethereumRpcUrls,
    inkRpcUrls,
    lineaRpcUrls,
    monadRpcUrls,
    optimismRpcUrls,
    plumeRpcUrls,
    polygonRpcUrls,
    seiRpcUrls,
    sonicRpcUrls,
    unichainRpcUrls,
    worldChainRpcUrls,
    xdcRpcUrls,
} from "src/configs/rpcs";
import { AssetKind } from "src/consts/AssetKind";

// CCTP v2 TokenMessenger is deployed at the same address on every EVM chain
// except EDGE (domain 28), which uses a distinct deployment. If / when we add
// EDGE, pass its address via the `tokenMessenger` override in the variant.
// https://developers.circle.com/cctp/evm-smart-contracts
export const tokenMessengerV2 = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
export const messageTransmitterV2 =
    "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";

type CctpVariant = {
    asset: string;
    chainName: string;
    // Short chain symbol shown in the asset selector.
    symbol: string;
    chainId: number;
    // Circle's domain id for the chain (https://developers.circle.com/cctp/evm-smart-contracts).
    domain: number;
    tokenAddress: string;
    rpcUrls: readonly string[];
    blockExplorerUrl: string;
    // Overrides `tokenMessengerV2` (only needed for EDGE).
    tokenMessenger?: string;
    // Native gas symbol (defaults to the chain symbol — correct for most L2s
    // that use ETH as gas, so callers supply it explicitly).
    gasToken: string;
    canSend?: boolean;
};

const createCctpVariantAsset = (variant: CctpVariant): Asset => ({
    type: AssetKind.ERC20,
    canSend: variant.canSend ?? true,
    blockExplorerUrl: {
        id: Explorer.Blockscout,
        normal: variant.blockExplorerUrl,
    },
    network: {
        symbol: variant.symbol,
        gasToken: variant.gasToken,
        chainName: variant.chainName,
        transport: NetworkTransport.Evm,
        chainId: variant.chainId,
        rpcUrls: variant.rpcUrls,
        nativeCurrency: {
            name: variant.gasToken,
            symbol: variant.gasToken,
            decimals: 18,
        },
    },
    bridge: {
        kind: BridgeKind.Cctp,
        canonicalAsset: "USDC",
        cctp: {
            domain: variant.domain,
            tokenMessenger: variant.tokenMessenger ?? tokenMessengerV2,
            messageTransmitter: messageTransmitterV2,
            transferMode: CctpTransferMode.Fast,
        },
    },
    token: {
        address: variant.tokenAddress,
        decimals: 6,
    },
});

// USDC contract addresses sourced from Circle's official list:
// https://developers.circle.com/stablecoins/usdc-contract-addresses
export const cctpVariants: CctpVariant[] = [
    {
        asset: "USDC-BASE",
        chainName: "Base",
        symbol: "BASE",
        chainId: 8453,
        domain: 6,
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        rpcUrls: baseRpcUrls,
        blockExplorerUrl: baseExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-ETH",
        chainName: "Ethereum",
        symbol: "ETH",
        chainId: 1,
        domain: 0,
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        rpcUrls: ethereumRpcUrls,
        blockExplorerUrl: ethereumExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-AVAX",
        chainName: "Avalanche",
        symbol: "AVAX",
        chainId: 43114,
        domain: 1,
        tokenAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        rpcUrls: avalancheRpcUrls,
        blockExplorerUrl: avalancheExplorerUrl,
        gasToken: "AVAX",
    },
    {
        asset: "USDC-OP",
        chainName: "Optimism",
        symbol: "OP",
        chainId: 10,
        domain: 2,
        tokenAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        rpcUrls: optimismRpcUrls,
        blockExplorerUrl: optimismExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-POL",
        chainName: "Polygon PoS",
        symbol: "POL",
        chainId: 137,
        domain: 7,
        tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        rpcUrls: polygonRpcUrls,
        blockExplorerUrl: polygonExplorerUrl,
        gasToken: "POL",
    },
    {
        asset: "USDC-UNI",
        chainName: "Unichain",
        symbol: "UNI",
        chainId: 130,
        domain: 10,
        tokenAddress: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
        rpcUrls: unichainRpcUrls,
        blockExplorerUrl: unichainExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-LINEA",
        chainName: "Linea",
        symbol: "LINEA",
        chainId: 59144,
        domain: 11,
        tokenAddress: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
        rpcUrls: lineaRpcUrls,
        blockExplorerUrl: lineaExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-CODEX",
        chainName: "Codex",
        symbol: "CODEX",
        chainId: 81224,
        domain: 12,
        tokenAddress: "0xd996633a415985DBd7D6D12f4A4343E31f5037cf",
        rpcUrls: codexRpcUrls,
        blockExplorerUrl: codexExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-SONIC",
        chainName: "Sonic",
        symbol: "SONIC",
        chainId: 146,
        domain: 13,
        tokenAddress: "0x29219dd400f2Bf60E5a23d13be72b486d4038894",
        rpcUrls: sonicRpcUrls,
        blockExplorerUrl: sonicExplorerUrl,
        gasToken: "S",
    },
    {
        asset: "USDC-WORLD",
        chainName: "World Chain",
        symbol: "WORLD",
        chainId: 480,
        domain: 14,
        tokenAddress: "0x79A02482A880bCe3F13E09da970dC34dB4cD24D1",
        rpcUrls: worldChainRpcUrls,
        blockExplorerUrl: worldChainExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-MON",
        chainName: "Monad",
        symbol: "MON",
        chainId: 143,
        domain: 15,
        tokenAddress: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
        rpcUrls: monadRpcUrls,
        blockExplorerUrl: monadExplorerUrl,
        gasToken: "MON",
    },
    {
        asset: "USDC-SEI",
        chainName: "Sei",
        symbol: "SEI",
        chainId: 1329,
        domain: 16,
        tokenAddress: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392",
        rpcUrls: seiRpcUrls,
        blockExplorerUrl: seiExplorerUrl,
        gasToken: "SEI",
    },
    {
        asset: "USDC-XDC",
        chainName: "XDC",
        symbol: "XDC",
        chainId: 50,
        domain: 18,
        tokenAddress: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1",
        rpcUrls: xdcRpcUrls,
        blockExplorerUrl: xdcExplorerUrl,
        gasToken: "XDC",
    },
    {
        asset: "USDC-INK",
        chainName: "Ink",
        symbol: "INK",
        chainId: 57073,
        domain: 21,
        tokenAddress: "0x2D270e6886d130D724215A266106e6832161EAEd",
        rpcUrls: inkRpcUrls,
        blockExplorerUrl: inkExplorerUrl,
        gasToken: "ETH",
    },
    {
        asset: "USDC-PLUME",
        chainName: "Plume",
        symbol: "PLUME",
        chainId: 98866,
        domain: 22,
        tokenAddress: "0x222365EF19F7947e5484218551B56bb3965Aa7aF",
        rpcUrls: plumeRpcUrls,
        blockExplorerUrl: plumeExplorerUrl,
        gasToken: "PLUME",
    },
];

export const cctpVariantAssets: Record<string, Asset> = Object.fromEntries(
    cctpVariants.map((variant) => [
        variant.asset,
        createCctpVariantAsset(variant),
    ]),
);
