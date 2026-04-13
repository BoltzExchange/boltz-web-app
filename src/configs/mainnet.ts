import type { Asset, Config, Usdt0Variant } from "src/configs/base";
import {
    Explorer,
    NetworkTransport,
    Usdt0Kind,
    arbitrumExplorer,
    arbitrumNetwork,
    baseConfig,
    chooseUrl,
} from "src/configs/base";
import { AssetKind } from "src/consts/AssetKind";

const rskFallback = import.meta.env.VITE_RSK_FALLBACK_ENDPOINT;
const polygonRpcEndpoint = import.meta.env.VITE_POLYGON_RPC_ENDPOINT;

const rskRpcUrls = ["https://public-node.rsk.co"];
if (rskFallback) {
    rskRpcUrls.push(rskFallback);
}

const polygonRpcUrls = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://rpc-mainnet.matic.quiknode.pro",
];
if (polygonRpcEndpoint) {
    polygonRpcUrls.unshift(polygonRpcEndpoint);
}

const getExplorerId = (transport: NetworkTransport): Explorer => {
    switch (transport) {
        case NetworkTransport.Evm:
            return Explorer.Blockscout;

        case NetworkTransport.Solana:
            return Explorer.Solscan;

        case NetworkTransport.Tron:
            return Explorer.Tronscan;
    }
};

const createUsdt0VariantAsset = (variant: Usdt0Variant): Asset => {
    const transport = variant.transport ?? NetworkTransport.Evm;
    const mesh = variant.mesh ?? Usdt0Kind.Native;

    const asset: Asset = {
        type: AssetKind.ERC20,
        canSend: variant.canSend,
        blockExplorerUrl: {
            id: getExplorerId(transport),
            normal: variant.blockExplorerUrl,
        },
        network: {
            chainName: variant.chainName,
            symbol: variant.symbol,
            gasToken: variant.gasToken ?? variant.symbol,
            transport,
            oftQuotePayer: variant.oftQuotePayer,
            rpcUrls: variant.rpcUrls,
            mesh,
        },
        token: {
            address: variant.tokenAddress,
            decimals: 6,
        },
    };
    if (transport === NetworkTransport.Evm) {
        asset.network.chainId = variant.chainId;
    }
    asset.network.nativeCurrency = {
        name: variant.gasToken ?? variant.symbol,
        symbol: variant.gasToken ?? variant.symbol,
        decimals: variant.nativeDecimals ?? 18,
        minGas: variant.minGas,
    };
    return asset;
};

const usdt0Variants: Usdt0Variant[] = [
    {
        asset: "USDT0-ETH",
        canSend: true,
        chainName: "Ethereum",
        symbol: "ETH",
        chainId: 1,
        tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        blockExplorerUrl: "https://etherscan.io",
        rpcUrls: ["https://ethereum-rpc.publicnode.com"],
    },
    {
        asset: "USDT0-BERA",
        canSend: true,
        chainName: "Berachain",
        symbol: "BERA",
        chainId: 80094,
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        blockExplorerUrl: "https://berascan.com",
        rpcUrls: ["https://rpc.berachain.com"],
    },
    {
        asset: "USDT0-CFX",
        canSend: false,
        chainName: "Conflux eSpace",
        symbol: "CFX",
        chainId: 1030,
        tokenAddress: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
        blockExplorerUrl: "https://evm.confluxscan.org",
        rpcUrls: ["https://evm.confluxrpc.com/"],
    },
    {
        asset: "USDT0-CORN",
        canSend: false,
        chainName: "Corn",
        symbol: "CORN",
        gasToken: "BTCN",
        chainId: 21000000,
        tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
        blockExplorerUrl: "https://cornscan.io",
        rpcUrls: ["https://mainnet.corn-rpc.com"],
    },
    {
        asset: "USDT0-FLR",
        canSend: false,
        chainName: "Flare",
        symbol: "FLR",
        gasToken: "SGB",
        chainId: 14,
        tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
        blockExplorerUrl: "https://flarescan.com",
        rpcUrls: [
            "https://rpc.ankr.com/flare",
            "https://flare-api.flare.network/ext/C/rpc",
        ],
    },
    {
        asset: "USDT0-HYPE",
        canSend: false,
        chainName: "HyperEVM",
        symbol: "HYPE",
        chainId: 999,
        tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
        blockExplorerUrl: "https://hyperevmscan.io",
        rpcUrls: ["https://rpc.hyperliquid.xyz/evm"],
    },
    {
        asset: "USDT0-HBAR",
        canSend: false,
        chainName: "Hedera",
        symbol: "HBAR",
        chainId: 295,
        tokenAddress: "0x00000000000000000000000000000000009Ce723",
        blockExplorerUrl: "https://hashscan.io/mainnet",
        rpcUrls: ["https://mainnet.hashio.io/api"],
    },
    {
        asset: "USDT0-INK",
        canSend: true,
        chainName: "Ink",
        symbol: "INK",
        gasToken: "ETH",
        chainId: 57073,
        tokenAddress: "0x0200C29006150606B650577BBE7B6248F58470c1",
        blockExplorerUrl: "https://explorer.inkonchain.com",
        rpcUrls: ["https://rpc-gel.inkonchain.com"],
    },
    {
        asset: "USDT0-MNT",
        canSend: false,
        chainName: "Mantle",
        symbol: "MNT",
        chainId: 5000,
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        blockExplorerUrl: "https://mantlescan.xyz",
        rpcUrls: ["https://rpc.mantle.xyz"],
    },
    {
        asset: "USDT0-MEGAETH",
        canSend: false,
        chainName: "MegaETH",
        symbol: "MEGAETH",
        gasToken: "ETH",
        chainId: 4326,
        tokenAddress: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
        blockExplorerUrl: "https://mega.etherscan.io/",
        rpcUrls: ["https://mainnet.megaeth.com/rpc"],
    },
    {
        asset: "USDT0-MON",
        canSend: false,
        chainName: "Monad",
        symbol: "MON",
        chainId: 143,
        tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
        blockExplorerUrl: "https://monadexplorer.com",
        rpcUrls: [
            "https://rpc3.monad.xyz",
            "https://rpc-mainnet.monadinfra.com",
        ],
    },
    {
        asset: "USDT0-MORPH",
        canSend: false,
        chainName: "Morph",
        symbol: "MORPH",
        gasToken: "ETH",
        chainId: 2818,
        tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
        blockExplorerUrl: "https://explorer.morph.network",
        rpcUrls: ["https://rpc.morph.network"],
    },
    {
        asset: "USDT0-OP",
        canSend: true,
        chainName: "Optimism",
        symbol: "OP",
        gasToken: "ETH",
        chainId: 10,
        tokenAddress: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
        blockExplorerUrl: "https://optimistic.etherscan.io",
        rpcUrls: ["https://mainnet.optimism.io/"],
    },
    {
        asset: "USDT0-PLASMA",
        canSend: false,
        chainName: "Plasma",
        symbol: "PLASMA",
        gasToken: "XPL",
        chainId: 9745,
        tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
        blockExplorerUrl: "https://plasmascan.to",
        rpcUrls: ["https://rpc.plasma.to"],
    },
    {
        asset: "USDT0-POL",
        canSend: true,
        chainName: "Polygon PoS",
        symbol: "POL",
        chainId: 137,
        tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        blockExplorerUrl: "https://polygonscan.com",
        rpcUrls: polygonRpcUrls,
    },
    {
        asset: "USDT0-RBTC",
        canSend: false,
        chainName: "Rootstock",
        symbol: "RBTC",
        chainId: 30,
        tokenAddress: "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
        blockExplorerUrl: "https://rootstock.blockscout.com",
        rpcUrls: rskRpcUrls,
    },
    {
        asset: "USDT0-SEI",
        canSend: true,
        chainName: "Sei",
        symbol: "SEI",
        chainId: 1329,
        tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
        blockExplorerUrl: "https://seitrace.com",
        rpcUrls: [
            "https://sei.api.pocket.network",
            "https://evm-rpc.sei-apis.com",
        ],
    },
    {
        asset: "USDT0-STABLE",
        canSend: false,
        chainName: "Stable",
        symbol: "STABLE",
        gasToken: "USDT0",
        chainId: 988,
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        blockExplorerUrl: "https://stablescan.xyz",
        rpcUrls: ["https://rpc.stable.xyz"],
    },
    {
        asset: "USDT0-UNI",
        canSend: true,
        chainName: "Unichain",
        symbol: "UNI",
        gasToken: "ETH",
        chainId: 130,
        tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
        blockExplorerUrl: "https://uniscan.xyz/",
        rpcUrls: ["https://unichain-rpc.publicnode.com"],
    },
    {
        asset: "USDT0-SOL",
        canSend: true,
        chainName: "Solana",
        symbol: "SOL",
        gasToken: "SOL",
        transport: NetworkTransport.Solana,
        nativeDecimals: 9,
        minGas: 1_500_000n,
        oftQuotePayer: "EzTybRqGouGB4vKin67HFYgLsVkzE6A1YUq26uKyTvPN",
        tokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        blockExplorerUrl: "https://solscan.io",
        rpcUrls: [
            "https://api.mainnet.solana.com",
            "https://solana-rpc.publicnode.com",
        ],
        mesh: Usdt0Kind.Legacy,
    },
    {
        asset: "USDT0-TRON",
        canSend: false,
        chainName: "Tron",
        symbol: "TRX",
        gasToken: "TRX",
        transport: NetworkTransport.Tron,
        tokenAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        blockExplorerUrl: "https://tronscan.org/#",
        rpcUrls: ["https://api.trongrid.io"],
        mesh: Usdt0Kind.Legacy,
    },
    {
        asset: "USDT0-XLAYER",
        canSend: false,
        chainName: "XLayer",
        symbol: "XLAYER",
        gasToken: "OKB",
        chainId: 196,
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        blockExplorerUrl: "https://www.oklink.com/x-layer",
        rpcUrls: ["https://xlayerrpc.okx.com"],
    },
    {
        asset: "USDT0-TEMPO",
        canSend: false,
        chainName: "Tempo",
        symbol: "USD",
        nativeDecimals: 6,
        chainId: 4217,
        tokenAddress: "0x20C00000000000000000000014f22CA97301EB73",
        blockExplorerUrl: "https://explore.mainnet.tempo.xyz",
        rpcUrls: ["https://rpc.tempo.xyz"],
    },
];

const usdt0VariantAssets = Object.fromEntries(
    usdt0Variants.map((variant) => [
        variant.asset,
        createUsdt0VariantAsset(variant),
    ]),
) as Record<string, Asset>;

const config = {
    ...baseConfig,
    torUrl: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/",
    network: "mainnet",
    loglevel: "debug",
    apiUrl: {
        normal: "https://api.boltz.exchange",
        tor: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api",
    },
    assets: {
        BTC: {
            type: AssetKind.UTXO,
            blockExplorerUrl: {
                id: Explorer.Mempool,
                normal: "https://mempool.space",
                tor: "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "https://blockstream.info/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/api",
                },
                {
                    id: Explorer.Mempool,
                    normal: "https://mempool.space/api",
                    tor: "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/api",
                },
            ],
        },
        "L-BTC": {
            type: AssetKind.UTXO,
            blockExplorerUrl: {
                id: Explorer.Esplora,
                normal: "https://blockstream.info/liquid",
                tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquid",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "https://blockstream.info/liquid/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquid/api",
                },
                {
                    id: Explorer.Mempool,
                    normal: "https://liquid.network/api",
                    tor: "http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion/api",
                },
            ],
        },
        RBTC: {
            type: AssetKind.EVMNative,
            blockExplorerUrl: {
                id: Explorer.Blockscout,
                normal: "https://rootstock.blockscout.com",
            },
            network: {
                chainName: "Rootstock",
                symbol: "RBTC",
                gasToken: "RBTC",
                transport: NetworkTransport.Evm,
                chainId: 30,
                rpcUrls: rskRpcUrls,
                nativeCurrency: {
                    name: "RBTC",
                    symbol: "RBTC",
                    decimals: 18,
                },
            },
            rifRelay: "https://boltz.mainnet.relay.rifcomputing.net",
            contracts: {
                deployHeight: 6747215,
                smartWalletFactory:
                    "0x44944a80861120B58cc48B066d57cDAf5eC213dd",
                deployVerifier: "0xc0F5bEF6b20Be41174F826684c663a8635c6A081",
            },
        },
        TBTC: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            token: {
                address: "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40",
                decimals: 18,
            },
            contracts: {
                deployHeight: 435848678,
                router: "0x6EA68e965fcd19b6fbC6553BABbF87a5018F9B28",
            },
        },
        USDT0: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            token: {
                address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
                decimals: 6,
                routeVia: "TBTC",
            },
        },
        ...usdt0VariantAssets,
    },
} as Config;

export { config, chooseUrl };
