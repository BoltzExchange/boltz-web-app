import type log from "loglevel";

import { type AssetKind } from "../consts/AssetKind";
import { Network } from "../consts/Network";

// TODO: which properties do we really need?
export type Usdt0Variant = {
    asset: string;
    chainName: string;
    symbol: string;
    chainId: number;
    tokenAddress: string;
    blockExplorerUrl: string;
    rpcUrls: string[];
};

export type Asset = {
    type: AssetKind;

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
        chainId: number;
        rpcUrls: string[];
        nativeCurrency: {
            name: string;
            symbol: string;
            decimals: number;
        };
    };
    token?: {
        address: string;
        decimals: number;
        routeVia?: string;
    };
};

export enum Explorer {
    Mempool = "mempool",
    Esplora = "esplora",
    Blockscout = "blockscout",
}

export type Url = {
    normal: string;
    tor?: string;
};

export type ExplorerUrl = Url & {
    id: Explorer;
};

export type Config = {
    apiUrl?: Url;
    network?: "mainnet" | "testnet" | "regtest";
    isBoltzClient?: boolean;
    boltzClientApiUrl?: string;
    isBeta?: boolean;
    isPro?: boolean;
    assets?: Record<string, Asset>;
    torUrl?: string;
} & typeof defaults;

export const arbitrumExplorer = {
    id: Explorer.Blockscout,
    normal: "https://arbiscan.io",
};

export const arbitrumNetwork = {
    symbol: "ARB",
    gasToken: "ETH",
    chainName: Network.Arbitrum,
    chainId: 42161,
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
    },
};

const defaults = {
    // Disables API endpoints that create cooperative signatures for claim
    // and refund transactions
    // **Should only be enabled for testing purposes**
    cooperativeDisabled: false,

    preventReloadOnPendingSwaps: true,

    loglevel: "info" as log.LogLevelDesc,
    defaultLanguage: "en",
    supportUrl: "https://support.boltz.exchange/hc/center",
    twitterUrl: "https://twitter.com/boltzhq",
    githubUrl: "https://github.com/BoltzExchange",
    repoUrl: "https://github.com/BoltzExchange/boltz-web-app",
    docsUrl: "https://docs.boltz.exchange",
    blogUrl: "https://blog.boltz.exchange",
    partnerUrl: "https://partner.boltz.exchange",
    nostrUrl:
        "https://primal.net/p/nprofile1qqsqcdcltmv4qanpx3p7svcufdsg9rkk00x7l2sknra4e6whkv59l7clgcdzj",
    statusUrl: "https://status.boltz.exchange",
    youtubeUrl:
        "https://www.youtube.com/playlist?list=PLkqOa9SGBeZfAEHvKkGKjeRIASeu6bNO3",
    brandingUrl: "https://github.com/BoltzExchange/logo",
    regtestUrl: "https://github.com/BoltzExchange/regtest/",
    email: "hi@bol.tz",
    dnsOverHttps: "https://1.1.1.1/dns-query",
    chatwootUrl: "https://support.boltz.exchange",
    preimageValidation: "https://validate-payment.com",
    layerZeroExplorerUrl: "https://layerzeroscan.com",
    rateProviders: {
        Yadio: "https://api.yadio.io/exrates/btc",
        Kraken: "https://api.kraken.com/0/public/Ticker",
        Mempool: "https://mempool.space/api/v1/prices",
        CoinGecko: "https://api.coingecko.com/api/v3/simple/price",
    },
};

const isTor = () => window?.location.hostname.endsWith(".onion");

const chooseUrl = (url?: Url) =>
    url ? (isTor() && url.tor ? url.tor : url.normal) : undefined;

const baseConfig: Config = defaults;

export { baseConfig, chooseUrl };
