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
    type ChainSwapExecuteArgs,
    type ChainSwapExecuteResult,
    type UtxoClaimKeys,
    executeChainSwap,
} from "./chain.ts";
import {
    type ChainSwapCreatedResponse,
    type CommitmentLockupDetails,
    type PartialSignature,
    type QuoteCalldata,
    type QuoteData,
    type ReverseCreatedResponse,
    type SubmarineCreatedResponse,
    type SwapStatusResponse,
    acceptChainSwapNewQuote,
    createChainSwap,
    createReverseSwap,
    createSubmarineSwap,
    encodeDexQuote,
    getChainSwapClaimDetails,
    getChainSwapNewQuote,
    getChainSwapTransactions,
    getCommitmentLockupDetails,
    getReverseTransaction,
    getSubmarineClaimDetails,
    getSubmarinePreimage,
    getSwapStatus,
    getSwapStatuses,
    postChainSwapDetails,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "./client.ts";
import {
    type BoltzSwapsConfig,
    type BoltzSwapsConfigInput,
    getBoltzSwapsConfig,
    getConfiguredNetwork,
    isEvmAsset,
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
    type ReverseExecuteArgs,
    type ReverseExecuteResult,
    executeReverseSwap,
} from "./reverse.ts";
import {
    type RouteQuote,
    type RouteQuoteAmountInArgs,
    type RouteQuoteAmountOutArgs,
    quoteRouteAmountIn,
    quoteRouteAmountOut,
} from "./route.ts";
import {
    type RouteCreateArgs,
    type RouteCreated,
    type RouteExecuteArgs,
    type RouteExecuteResult,
    createRoute,
    executeRoute,
} from "./routeExecute.ts";
import {
    type StatusErrorHandler,
    type StatusSource,
    type StatusUpdateHandler,
    type SwapUpdate,
    type WatchOptions,
    createDefaultStatusSource,
    watchStatus,
} from "./statusSource/index.ts";
import {
    type RefundResult,
    type RefundSubmarineUtxoParams,
    type SignSubmarineClaimArgs,
    getSubmarineEvmRefundSignature,
    refundSubmarineUtxo,
    signSubmarineClaim,
} from "./submarine.ts";
import type { Asset } from "./types.ts";
import type { UtxoAsset, UtxoNetwork } from "./utxo/index.ts";

export type BoltzClientConfig<A extends string = string> =
    BoltzSwapsConfigInput<A> | (() => BoltzSwapsConfigInput<A>);

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

export type SubmarineCreateArgs<A extends string = string> = {
    from: A;
    to: A;
    invoice: string;
    pairHash: string;
    refundPublicKey?: string;
};

export type ReverseCreateArgs<A extends string = string> = {
    from: A;
    to: A;
    invoiceAmount: number;
    preimageHash: string;
    pairHash: string;
    claimPublicKey?: string;
    claimAddress?: string;
};

export type SubmarineSignClaimArgs<A extends string = string> = Omit<
    SignSubmarineClaimArgs,
    "asset"
> & {
    asset: A;
};

export type SubmarineRefundUtxoArgs = Omit<
    RefundSubmarineUtxoParams,
    "network"
> & {
    network?: UtxoNetwork;
};

export type ChainSwapClaimSubmitBody = {
    preimage: string | undefined;
    signature: { pubNonce: string; partialSignature: string } | undefined;
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
        status(id: string): Promise<SwapStatusResponse>;
        statuses(ids: string[]): Promise<Record<string, SwapStatusResponse>>;
        subscribe(
            id: string,
            onUpdate: StatusUpdateHandler,
            onError?: StatusErrorHandler,
        ): () => void;
        watch(id: string, options?: WatchOptions): AsyncIterable<SwapUpdate>;
        chain: {
            create(
                args: ChainSwapCreateArgs<A>,
            ): Promise<ChainSwapCreatedResponse>;
            execute(
                args: ChainSwapExecuteArgs<A>,
            ): Promise<ChainSwapExecuteResult>;
            transactions: typeof getChainSwapTransactions;
            newQuote: typeof getChainSwapNewQuote;
            acceptNewQuote: typeof acceptChainSwapNewQuote;
        };
        submarine: {
            create(
                args: SubmarineCreateArgs<A>,
            ): Promise<SubmarineCreatedResponse>;
            claimDetails: typeof getSubmarineClaimDetails;
            preimage: typeof getSubmarinePreimage;
            signClaim(args: SubmarineSignClaimArgs<A>): Promise<void>;
            refundUtxo(args: SubmarineRefundUtxoArgs): Promise<RefundResult>;
            refundEvmSignature(id: string): Promise<{ signature: Hex }>;
        };
        reverse: {
            create(args: ReverseCreateArgs<A>): Promise<ReverseCreatedResponse>;
            execute(args: ReverseExecuteArgs<A>): Promise<ReverseExecuteResult>;
            transaction: typeof getReverseTransaction;
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
        create(args: RouteCreateArgs<A>): Promise<RouteCreated<A>>;
        execute(args: RouteExecuteArgs<A>): Promise<RouteExecuteResult>;
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
    "network",
    "gasSponsor",
    "defaultSlippage",
    "statusSource",
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

    // One status source per client so the WebSocket source can multiplex all
    // of the client's swaps over a single connection.
    let statusSource: StatusSource | undefined;
    const getStatusSource = (): StatusSource =>
        (statusSource ??=
            getBoltzSwapsConfig().statusSource ?? createDefaultStatusSource());

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
            status: (id) => getSwapStatus(id),
            statuses: (ids) => getSwapStatuses(ids),
            subscribe: (id, onUpdate, onError) =>
                getStatusSource().subscribe(id, onUpdate, onError),
            watch: (id, options) => watchStatus(getStatusSource(), id, options),
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
                execute: (args) => executeChainSwap(args),
                transactions: getChainSwapTransactions,
                newQuote: getChainSwapNewQuote,
                acceptNewQuote: acceptChainSwapNewQuote,
            },
            submarine: {
                create: ({ from, to, invoice, pairHash, refundPublicKey }) =>
                    createSubmarineSwap(
                        from,
                        to,
                        invoice,
                        pairHash,
                        refundPublicKey,
                    ),
                claimDetails: getSubmarineClaimDetails,
                preimage: getSubmarinePreimage,
                signClaim: async (args) => {
                    if (isEvmAsset(args.asset)) {
                        return;
                    }
                    await signSubmarineClaim({
                        ...args,
                        asset: args.asset as UtxoAsset,
                    });
                },
                refundUtxo: (args) =>
                    refundSubmarineUtxo({
                        ...args,
                        network: args.network ?? getConfiguredNetwork(),
                    }),
                refundEvmSignature: getSubmarineEvmRefundSignature,
            },
            reverse: {
                create: ({
                    from,
                    to,
                    invoiceAmount,
                    preimageHash,
                    pairHash,
                    claimPublicKey,
                    claimAddress,
                }) =>
                    createReverseSwap(
                        from,
                        to,
                        invoiceAmount,
                        preimageHash,
                        pairHash,
                        claimPublicKey,
                        claimAddress,
                    ),
                execute: (args) => executeReverseSwap(args),
                transaction: getReverseTransaction,
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
            create: (args) => createRoute(args),
            execute: (args) => executeRoute(args),
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
    ChainSwapExecuteArgs,
    ChainSwapExecuteResult,
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
    RefundResult,
    RelayClaimTransactionFn,
    ReverseCreatedResponse,
    ReverseExecuteArgs,
    ReverseExecuteResult,
    RouterCall,
    SendTransactionFn,
    SubmarineCreatedResponse,
    SwapStatusResponse,
    UtxoClaimKeys,
};
