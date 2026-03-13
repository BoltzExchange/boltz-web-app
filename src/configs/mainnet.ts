import type { Asset, Config, Usdt0Variant } from "src/configs/base";
import {
    Explorer,
    arbitrumExplorer,
    arbitrumNetwork,
    baseConfig,
    chooseUrl,
} from "src/configs/base";
import { AssetKind } from "src/consts/AssetKind";

const rskFallback = import.meta.env.VITE_RSK_FALLBACK_ENDPOINT;

const rskRpcUrls = ["https://public-node.rsk.co"];
if (rskFallback) {
    rskRpcUrls.push(rskFallback);
}

const createUsdt0VariantAsset = ({
    chainName,
    symbol,
    chainId,
    tokenAddress,
    blockExplorerUrl,
}: Usdt0Variant): Asset => ({
    type: AssetKind.ERC20,
    blockExplorerUrl: {
        id: Explorer.Blockscout,
        normal: blockExplorerUrl,
    },
    network: {
        chainName,
        symbol,
        gasToken: symbol,
        chainId,
        rpcUrls: [],
        nativeCurrency: {
            name: symbol,
            symbol,
            decimals: 18,
        },
    },
    token: {
        address: tokenAddress,
        decimals: 6,
    },
});

const usdt0Variants: Usdt0Variant[] = [
    {
        asset: "USDT0-ETH",
        chainName: "Ethereum",
        symbol: "ETH",
        chainId: 1,
        tokenAddress: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
        blockExplorerUrl: "https://etherscan.io",
    },
    {
        asset: "USDT0-BERA",
        chainName: "Berachain",
        symbol: "BERA",
        chainId: 80094,
        tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
        blockExplorerUrl: "https://berascan.com",
    },
    {
        asset: "USDT0-INK",
        chainName: "Ink",
        symbol: "INK",
        chainId: 57073,
        tokenAddress: "0x0200C29006150606B650577BBE7B6248F58470c1",
        blockExplorerUrl: "https://explorer.inkonchain.com",
    },
    {
        asset: "USDT0-OP",
        chainName: "Optimism",
        symbol: "OP",
        chainId: 10,
        tokenAddress: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
        blockExplorerUrl: "https://optimistic.etherscan.io",
    },
    {
        asset: "USDT0-POL",
        chainName: "Polygon PoS",
        symbol: "POL",
        chainId: 137,
        tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        blockExplorerUrl: "https://polygonscan.com",
    },
    {
        asset: "USDT0-SEI",
        chainName: "Sei",
        symbol: "SEI",
        chainId: 1329,
        tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
        blockExplorerUrl: "https://seitrace.com",
    },
    {
        asset: "USDT0-UNI",
        chainName: "Unichain",
        symbol: "UNI",
        chainId: 130,
        tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
        blockExplorerUrl: "https://unichain.blockscout.com",
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
                router: "0xaB6B467FC443Ca37a8E5aA11B04ea29434688d61",
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
