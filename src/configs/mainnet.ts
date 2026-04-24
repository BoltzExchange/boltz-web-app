import type { Config } from "src/configs/base";
import {
    BridgeKind,
    CctpTransferMode,
    Explorer,
    NetworkTransport,
    Usdt0Kind,
    arbitrumChainId,
    baseConfig,
    chooseUrl,
} from "src/configs/base";
import { cctpVariantAssets, tokenMessengerV2 } from "src/configs/cctp";
import { arbitrumExplorerUrl } from "src/configs/explorers";
import { arbitrumRpcUrls, rskRpcUrls } from "src/configs/rpcs";
import { usdt0VariantAssets } from "src/configs/usdt0";
import { AssetKind } from "src/consts/AssetKind";
import { Network } from "src/consts/Network";

const arbitrumExplorer = {
    id: Explorer.Blockscout,
    normal: arbitrumExplorerUrl,
};

const arbitrumNetwork = {
    symbol: "ARB",
    gasToken: "ETH",
    chainName: Network.Arbitrum,
    transport: NetworkTransport.Evm,
    chainId: arbitrumChainId,
    rpcUrls: arbitrumRpcUrls,
    nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
    },
};

const config = {
    ...baseConfig,
    torUrl: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/",
    network: "mainnet",
    loglevel: "debug",
    apiUrl: {
        normal: "https://api.boltz.exchange",
        tor: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api",
    },
    cctpApiUrl: "https://iris-api.circle.com",
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
                router: "0x182589d2A10384e12EE8C1Fe350F4dfba36C7b73",
            },
        },
        USDT0: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            bridge: {
                kind: BridgeKind.Oft,
                canonicalAsset: "USDT0",
                oft: {
                    mesh: Usdt0Kind.Native,
                },
            },
            token: {
                address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
                decimals: 6,
                routeVia: "TBTC",
            },
        },
        USDC: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            bridge: {
                kind: BridgeKind.Cctp,
                canonicalAsset: "USDC",
                cctp: {
                    domain: 3,
                    tokenMessenger: tokenMessengerV2,
                    transferMode: CctpTransferMode.Fast,
                },
            },
            token: {
                address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                decimals: 6,
                routeVia: "TBTC",
            },
        },
        ...usdt0VariantAssets,
        ...cctpVariantAssets,
    },
} as Config;

export { config, chooseUrl };
