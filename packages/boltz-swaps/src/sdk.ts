import type { Hex, Signature, TransactionRequest } from "viem";

import {
    type BridgeDriver,
    type BridgeQuoteOptions,
    type BridgeReceiveQuote,
    type BridgeRoute,
    type BridgeSendQuote,
    type EncodeRouterExecuteArgs,
    type LooseRouterCall,
    type PopulateRouterClaimBridgeArgs,
    type RouterCall,
    bridgeRegistry,
    toRouterCalls,
    vFromSignature,
} from "./bridge/index.ts";
import {
    type ChainSwapCreatedResponse,
    type CommitmentLockupDetails,
    type PartialSignature,
    type QuoteCalldata,
    type QuoteData,
    acceptChainSwapNewQuote,
    createChainSwap,
    encodeDexQuote,
    getChainSwapClaimDetails,
    getChainSwapNewQuote,
    getChainSwapTransactions,
    getCommitmentLockupDetails,
    postChainSwapDetails,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "./client.ts";
import {
    type BoltzSwapsConfig,
    type BoltzSwapsConfigInput,
    setBoltzSwapsConfig,
} from "./config.ts";
import {
    buildCommitmentRefundAuthMessage,
    getCommitmentRefundSignature,
    isEmptyPreimageHash,
    postCommitmentSignatureForTransaction,
} from "./evm/commitment.ts";
import type { Erc20SwapContract, EtherSwapContract } from "./evm/contracts.ts";
import {
    type ClaimAssetParams,
    type ClaimResult,
    type PopulatedEvmTransaction,
    type RelayClaimTransactionFn,
    type SendTransactionFn,
    claimAsset,
} from "./evm/transaction.ts";
import {
    type RouteQuote,
    type RouteQuoteAmountInArgs,
    type RouteQuoteAmountOutArgs,
    quoteRouteAmountIn,
    quoteRouteAmountOut,
} from "./route.ts";
import type { Asset } from "./types.ts";

export type BoltzClientConfig<A extends string = string> =
    | BoltzSwapsConfigInput<A>
    | (() => BoltzSwapsConfigInput<A>);

// Helper for declaring an asset registry with literal-typed keys preserved
// for use with `createBoltzClient`. Combine with `AssetSymbolOf` to derive
// the union type of asset symbols from the registry.
//
//   const ASSETS = defineAssets({ BTC: {...}, "USDC-ETH": {...} });
//   type AssetSymbol = AssetSymbolOf<typeof ASSETS>;  // "BTC" | "USDC-ETH"
//   const boltz = createBoltzClient({ assets: ASSETS, boltzApiUrl: ... });
//   boltz.route.quoteAmountOut({ from: "BTC", to: "USDC-ETH", ... });  // typed
export const defineAssets = <const T extends Record<string, Asset>>(
    assets: T,
): T => assets;

export type AssetSymbolOf<T extends Record<string, unknown>> = keyof T & string;

export type DexQuoteAmountInArgs = {
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
};

export type DexQuoteAmountOutArgs = {
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amountOut: bigint;
};

export type DexEncodeArgs = {
    chain: string;
    recipient: string;
    amountIn: bigint;
    amountOutMin: bigint;
    data: unknown;
};

export type BridgeQuoteSendArgs<A extends string = string> = {
    route: BridgeRoute<A>;
    recipient: string | undefined;
    amount: bigint;
    options?: BridgeQuoteOptions;
};

export type BridgeQuoteReceiveArgs<A extends string = string> = {
    route: BridgeRoute<A>;
    amount: bigint;
    options?: BridgeQuoteOptions;
};

export type BridgeQuoteAmountInArgs<A extends string = string> = {
    route: BridgeRoute<A>;
    amountOut: bigint;
    options?: BridgeQuoteOptions;
};

export type ChainSwapCreateArgs<A extends string = string> = {
    from: A;
    to: A;
    userLockAmount?: number;
    preimageHash: string;
    claimPublicKey?: string;
    refundPublicKey?: string;
    claimAddress?: string;
    pairHash: string;
};

export type ChainSwapClaimSubmitBody = {
    preimage: string | undefined;
    signature: { pubNonce: string; partialSignature: string };
    toSign?: { pubNonce: string; transaction: string; index: number };
};

export type ConfirmCommitmentArgs = Parameters<
    typeof postCommitmentSignatureForTransaction
>[0];

export type CommitmentRefundSignatureArgs = Parameters<
    typeof getCommitmentRefundSignature
>[0];

export type RefundAuthMessageArgs = {
    chainSymbol: string;
    transactionHash: string;
    logIndex?: number;
};

export type ClaimEvmArgs<A extends string = string> = Omit<
    ClaimAssetParams,
    "asset"
> & {
    asset: A;
};

export interface BoltzClient<A extends string = string> {
    readonly dex: {
        quoteAmountIn(args: DexQuoteAmountInArgs): Promise<QuoteData[]>;
        quoteAmountOut(args: DexQuoteAmountOutArgs): Promise<QuoteData[]>;
        encode(args: DexEncodeArgs): Promise<{ calls: QuoteCalldata[] }>;
    };
    readonly bridge: {
        driver(route: BridgeRoute<A>): BridgeDriver;
        quoteSend(args: BridgeQuoteSendArgs<A>): Promise<BridgeSendQuote>;
        quoteReceive(
            args: BridgeQuoteReceiveArgs<A>,
        ): Promise<BridgeReceiveQuote>;
        quoteAmountIn(args: BridgeQuoteAmountInArgs<A>): Promise<bigint>;
        toRouterCalls(calls: readonly LooseRouterCall[]): RouterCall[];
        vFromSignature(signature: Signature): number;
    };
    readonly swap: {
        chain: {
            create(
                args: ChainSwapCreateArgs<A>,
            ): Promise<ChainSwapCreatedResponse>;
            transactions: typeof getChainSwapTransactions;
            newQuote: typeof getChainSwapNewQuote;
            acceptNewQuote: typeof acceptChainSwapNewQuote;
        };
        lock: {
            commitmentDetails(currency: A): Promise<CommitmentLockupDetails>;
            confirmCommitment(args: ConfirmCommitmentArgs): Promise<void>;
            postRefundSignature(
                args: CommitmentRefundSignatureArgs,
            ): Promise<Hex>;
            buildRefundAuthMessage(args: RefundAuthMessageArgs): string;
        };
        claim: {
            details: typeof getChainSwapClaimDetails;
            submit(
                id: string,
                body: ChainSwapClaimSubmitBody,
            ): Promise<{ pubNonce: string; partialSignature: string }>;
            executeEvm(args: ClaimEvmArgs<A>): Promise<ClaimResult>;
            executeBridgeRouterClaim(
                args: PopulateRouterClaimBridgeArgs,
            ): Promise<TransactionRequest>;
            isEmptyPreimageHash(hash: string | undefined): boolean;
        };
    };
    readonly route: {
        quoteAmountOut(
            args: RouteQuoteAmountOutArgs<A>,
        ): Promise<RouteQuote<A>>;
        quoteAmountIn(args: RouteQuoteAmountInArgs<A>): Promise<RouteQuote<A>>;
    };
}

const configKeys: ReadonlyArray<keyof BoltzSwapsConfig> = [
    "assets",
    "cctpApiUrl",
    "solburnUrl",
    "layerZeroExplorerUrl",
    "cctpExplorerUrl",
    "oftDeploymentsUrl",
    "gasTopUpSupported",
    "getGasTopUpNativeAmount",
    "boltzApiUrl",
    "referral",
    "cooperativeDisabled",
];

const buildConfigProxy = <A extends string>(
    input: BoltzClientConfig<A>,
): BoltzSwapsConfigInput<A> => {
    const resolve = (): BoltzSwapsConfigInput<A> =>
        typeof input === "function" ? input() : input;

    const proxy = {} as BoltzSwapsConfigInput<A>;
    for (const key of configKeys) {
        Object.defineProperty(proxy, key, {
            enumerable: true,
            configurable: false,
            get: () => resolve()[key],
        });
    }
    return proxy;
};

export const createBoltzClient = <A extends string = string>(
    input: BoltzClientConfig<A>,
): BoltzClient<A> => {
    setBoltzSwapsConfig(buildConfigProxy(input));

    const client: BoltzClient<A> = {
        dex: {
            quoteAmountIn: ({ chain, tokenIn, tokenOut, amountIn }) =>
                quoteDexAmountIn(chain, tokenIn, tokenOut, amountIn),
            quoteAmountOut: ({ chain, tokenIn, tokenOut, amountOut }) =>
                quoteDexAmountOut(chain, tokenIn, tokenOut, amountOut),
            encode: ({ chain, recipient, amountIn, amountOutMin, data }) =>
                encodeDexQuote(chain, recipient, amountIn, amountOutMin, data),
        },
        bridge: {
            driver: (route) => bridgeRegistry.requireDriverForRoute(route),
            quoteSend: async ({ route, recipient, amount, options }) => {
                const driver = bridgeRegistry.requireDriverForRoute(route);
                const contract = await driver.getQuotedContract(route);
                return driver.quoteSend(
                    contract,
                    route,
                    recipient,
                    amount,
                    options,
                );
            },
            quoteReceive: ({ route, amount, options }) =>
                bridgeRegistry
                    .requireDriverForRoute(route)
                    .quoteReceiveAmount(route, amount, options),
            quoteAmountIn: ({ route, amountOut, options }) =>
                bridgeRegistry
                    .requireDriverForRoute(route)
                    .quoteAmountInForAmountOut(route, amountOut, options),
            toRouterCalls,
            vFromSignature,
        },
        swap: {
            chain: {
                create: ({
                    from,
                    to,
                    userLockAmount,
                    preimageHash,
                    claimPublicKey,
                    refundPublicKey,
                    claimAddress,
                    pairHash,
                }) =>
                    createChainSwap(
                        from,
                        to,
                        userLockAmount,
                        preimageHash,
                        claimPublicKey,
                        refundPublicKey,
                        claimAddress,
                        pairHash,
                    ),
                transactions: getChainSwapTransactions,
                newQuote: getChainSwapNewQuote,
                acceptNewQuote: acceptChainSwapNewQuote,
            },
            lock: {
                commitmentDetails: getCommitmentLockupDetails,
                confirmCommitment: postCommitmentSignatureForTransaction,
                postRefundSignature: getCommitmentRefundSignature,
                buildRefundAuthMessage: ({
                    chainSymbol,
                    transactionHash,
                    logIndex,
                }) =>
                    buildCommitmentRefundAuthMessage(
                        chainSymbol,
                        transactionHash,
                        logIndex,
                    ),
            },
            claim: {
                details: getChainSwapClaimDetails,
                submit: (id, { preimage, signature, toSign }) =>
                    postChainSwapDetails(id, preimage, signature, toSign),
                executeEvm: (args) => claimAsset(args),
                executeBridgeRouterClaim: (args) =>
                    bridgeRegistry
                        .requireDriverForRoute(args.route)
                        .populateRouterClaimBridgeTransaction(args),
                isEmptyPreimageHash,
            },
        },
        route: {
            quoteAmountOut: (args) => quoteRouteAmountOut(args),
            quoteAmountIn: (args) => quoteRouteAmountIn(args),
        },
    };
    return client;
};

export type {
    BoltzSwapsConfig,
    BridgeDriver,
    BridgeQuoteOptions,
    BridgeReceiveQuote,
    BridgeRoute,
    BridgeSendQuote,
    ChainSwapCreatedResponse,
    ClaimResult,
    CommitmentLockupDetails,
    EncodeRouterExecuteArgs,
    Erc20SwapContract,
    EtherSwapContract,
    LooseRouterCall,
    PartialSignature,
    PopulateRouterClaimBridgeArgs,
    PopulatedEvmTransaction,
    QuoteCalldata,
    QuoteData,
    RelayClaimTransactionFn,
    RouterCall,
    SendTransactionFn,
};
