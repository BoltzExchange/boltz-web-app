export enum NetworkTransport {
    Evm = "evm",
    Solana = "solana",
    Tron = "tron",
}

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
    Blockscout = "blockscout",
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

export type Usdt0Variant = {
    asset: string;
    canSend: boolean;
    disabled?: boolean;
    chainName: string;
    symbol: string;
    nativeDecimals?: number;
    minGas?: bigint;
    gasToken?: string;
    transport?: NetworkTransport;
    chainId?: number;
    oftQuotePayer?: string;
    tokenAddress: string;
    blockExplorerUrl: string;
    rpcUrls: readonly string[];
    mesh?: Usdt0Kind;
};

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
