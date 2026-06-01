import type { Address, Hex } from "viem";

export enum NetworkTransport {
    Evm = "evm",
    Solana = "solana",
    Tron = "tron",
}

export enum SwapType {
    Submarine = "submarine",
    Reverse = "reverse",
    Chain = "chain",
    Commitment = "commitment",
    Dex = "dex",
}

export enum RskRescueMode {
    Refund = "refund",
    Claim = "resume",
}

export enum GasAbstractionType {
    None = "none",
    RifRelay = "rifRelay",
    Signer = "signer",
}

export const arbitrumChainId = 42161;

export type FetchOptions = {
    signal?: AbortSignal;
    // Bounds the whole operation end-to-end, not each request.
    timeoutMs?: number;
};

export type AssetType =
    | "LN"
    | "BTC"
    | "L-BTC"
    | "RBTC"
    | "TBTC"
    | "WBTC"
    | "USDT0"
    | "USDC";

export type RefundableAssetType = "BTC" | "L-BTC" | "RBTC" | "TBTC";

export type ContractAddresses = {
    EtherSwap: string;
    ERC20Swap: string;
};

export type Contracts = {
    network: {
        chainId: number;
        name: string;
    };
    swapContracts: ContractAddresses;
    supportedContracts: Record<
        string,
        ContractAddresses & { features: string[] }
    >;
    tokens: Record<string, string>;
};

export type LockupEvent = {
    preimageHash: Hex;
    amount: bigint;
    tokenAddress?: Address;
    claimAddress: Address;
    refundAddress: Address;
    timelock: bigint;
    logIndex: number;
};

export type LogRefundData = {
    asset: AssetType;
    blockNumber: number;
    transactionHash: Hex;

    preimageHash: Hex;
    preimage?: Hex;
    amount: bigint;
    tokenAddress?: Address;
    claimAddress: Address;
    refundAddress: Address;
    timelock: bigint;
};

export enum BridgeKind {
    Oft = "oft",
    Cctp = "cctp",
}

export enum CctpTransferMode {
    Fast = "fast",
    Standard = "standard",
}

export enum CctpReceiveMode {
    Forwarded = "forwarded",
    Manual = "manual",
}

export enum Usdt0Kind {
    Native = "native",
    Legacy = "legacy",
}

export enum SwapPosition {
    Pre = "pre",
    Post = "post",
}

export enum AssetKind {
    UTXO = "UTXO",
    EVMNative = "EVM_NATIVE",
    ERC20 = "ERC20",
}

export enum Explorer {
    Mempool = "mempool",
    Esplora = "esplora",
    EtherscanStyle = "etherscan-style",
    Solscan = "solscan",
    Tronscan = "tronscan",
}

export enum ExplorerKind {
    Asset = "asset",
    Cctp = "cctp",
    LayerZero = "layerzero",
}

export type Url = {
    normal: string;
    tor?: string;
};

export type ExplorerUrl = Url & {
    id: Explorer;
};

type OftAssetBridge = {
    kind: BridgeKind.Oft;
    canonicalAsset: string;
    oft?: {
        mesh?: Usdt0Kind;
        // Address used to simulate bridge quote transactions when no wallet
        // is connected. Only needed on Solana.
        quotePayer?: string;
    };
};

type CctpAssetBridge = {
    kind: BridgeKind.Cctp;
    canonicalAsset: string;
    cctp: {
        domain: number;
        tokenMessenger: string;
        messageTransmitter: string;
        transferMode: CctpTransferMode;
    };
};

export type AssetBridge = OftAssetBridge | CctpAssetBridge;

export type SolanaDetails = {
    blockhash: string;
};

export type BridgeDetails = {
    solana?: SolanaDetails;
};

export type BridgeTransaction = {
    hash: string;
    details?: BridgeDetails;
};

export type Asset = {
    type: AssetKind;
    canSend?: boolean;
    disabled?: boolean;

    blockExplorerUrl?: ExplorerUrl;
    blockExplorerApis?: ExplorerUrl[];

    rifRelay?: string;
    contracts?: {
        deployHeight: number;
        router?: string;
        smartWalletFactory?: string;
        deployVerifier?: string;
    };
    network?: {
        chainName: string;
        symbol: string;
        gasToken: string;
        transport: NetworkTransport;
        chainId?: number;
        rpcUrls: readonly string[];
        nativeCurrency?: {
            name: string;
            symbol: string;
            decimals: number;
            // Minimum native token balance, in base units, to target for gas top-ups.
            minGas?: bigint;
        };
    };
    bridge?: AssetBridge;
    token?: {
        address: string;
        decimals: number;
        routeVia?: string;
    };
};
