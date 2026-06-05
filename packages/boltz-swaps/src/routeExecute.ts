import { type Hash, getAddress, isAddressEqual, zeroAddress } from "viem";

import { bridgeRegistry } from "./bridge/index.ts";
import type { BridgeRoute } from "./bridge/route.ts";
import type { LooseRouterCall } from "./bridge/router.ts";
import {
    type ChainSwapCreatedResponse,
    type Pairs,
    createChainSwap,
    encodeDexQuote,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "./client.ts";
import {
    getConfiguredDefaultSlippage,
    getKindForAsset,
    getTokenAddress,
    isEvmAsset,
} from "./config.ts";
import {
    type Erc20SwapContract,
    createRouterContract,
} from "./evm/contracts.ts";
import { satsToAssetAmount } from "./evm/rootstock.ts";
import {
    dexCalldataToRouterCalls,
    encodeRouterClaimExecuteTx,
    signErc20ClaimToRouter,
    signRouterClaim,
} from "./evm/routerClaim.ts";
import { sendPopulatedTransaction } from "./evm/sender.ts";
import { buildSwapContractsForAsset } from "./evm/swapContracts.ts";
import type { PopulatedEvmTransaction } from "./evm/transaction.ts";
import { executeChainSwap } from "./execute.ts";
import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
} from "./helper.ts";
import type { Signer } from "./interfaces/signer.ts";
import { type RoutePlan, planRoute } from "./route.ts";
import {
    AssetKind,
    GasAbstractionType,
    NetworkTransport,
    SwapType,
} from "./types.ts";

export type RouteCreateArgs<A extends string = string> = {
    from: A;
    to: A;
    pairs: Pairs;
    preimageHash: string;
    claimAddress: string;
    refundPublicKey?: string;
    userLockAmount?: number;
};

export type RouteCreated<A extends string = string> = {
    createdSwap: ChainSwapCreatedResponse;
    plan: RoutePlan<A>;
};

export type RouteExecuteArgs<A extends string = string> = {
    createdSwap: ChainSwapCreatedResponse;
    plan: RoutePlan<A>;
    preimage: string;
    signer: Signer;
    recipient: string;
    refundAddress?: string;
    slippage?: number;
};

export type RouteExecuteResult = {
    claimTransactionId: string;
};

export const createRoute = async <A extends string = string>(
    args: RouteCreateArgs<A>,
): Promise<RouteCreated<A>> => {
    const plan = planRoute(args.from, args.to, args.pairs);

    const pairHash =
        args.pairs[SwapType.Chain]?.[args.from]?.[plan.chainSwap.to]?.hash;
    if (pairHash === undefined) {
        throw new Error(
            `no chain-swap pair hash for ${args.from} -> ${plan.chainSwap.to}`,
        );
    }

    const createdSwap = await createChainSwap(
        args.from,
        plan.chainSwap.to,
        args.userLockAmount,
        args.preimageHash,
        undefined,
        args.refundPublicKey,
        args.claimAddress,
        pairHash,
    );

    return { createdSwap, plan };
};

type RouterClaimContext<A extends string> = {
    asset: A;
    assetAmount: bigint;
    tokenAddress: string;
    chainId: bigint;
    preimage: string;
    refundAddress: string;
    timeoutBlockHeight: number;
    recipient: string;
    slippage: number;
    signer: Signer;
    erc20Swap: Erc20SwapContract;
};

const toBridgeRoute = (bridge: {
    sourceAsset: string;
    destinationAsset: string;
}): BridgeRoute => ({
    sourceAsset: bridge.sourceAsset,
    destinationAsset: bridge.destinationAsset,
});

const claimViaRouterBridge = async <A extends string>(
    ctx: RouterClaimContext<A>,
    dex: { chain: string; tokenIn: string; tokenOut: string } | undefined,
    bridgeLeg: { sourceAsset: string; destinationAsset: string },
): Promise<Hash> => {
    const bridge = toBridgeRoute(bridgeLeg);
    const driver = bridgeRegistry.requireDriverForRoute(bridge);
    if (driver.getTransport(bridge.sourceAsset) !== NetworkTransport.Evm) {
        throw new Error("bridge router claim requires an EVM source contract");
    }

    const router = createRouterContract(ctx.asset, ctx.signer);
    const bridgeContract = await driver.getContract(bridge);
    const quoteContract = await driver.getQuotedContract(bridge);
    const quoteOptions = await driver.buildQuoteOptions(
        bridge.destinationAsset,
        ctx.recipient,
        false,
    );

    const routerCalls: LooseRouterCall[] = [];
    let bridgeInput: bigint;
    let outputTokenAddress: string;

    if (dex !== undefined) {
        let [tradeQuote] = await quoteDexAmountIn(
            dex.chain,
            dex.tokenIn,
            dex.tokenOut,
            ctx.assetAmount,
        );
        const { msgFee } = await driver.quoteSend(
            quoteContract,
            bridge,
            ctx.recipient,
            BigInt(tradeQuote.quote),
            quoteOptions,
        );

        let msgFeeEthQuote;
        let tradeAmountIn = ctx.assetAmount;
        if (msgFee[0] > 0n) {
            const msgFeeEthAmountOut = calculateAmountWithSlippage(
                msgFee[0],
                ctx.slippage,
            );
            [msgFeeEthQuote] = await quoteDexAmountOut(
                dex.chain,
                dex.tokenIn,
                zeroAddress,
                msgFeeEthAmountOut,
            );
            tradeAmountIn = ctx.assetAmount - BigInt(msgFeeEthQuote.quote);
            if (tradeAmountIn <= 0n) {
                throw new Error(
                    "amount too small to cover bridge messaging fee",
                );
            }
            [tradeQuote] = await quoteDexAmountIn(
                dex.chain,
                dex.tokenIn,
                dex.tokenOut,
                tradeAmountIn,
            );
        }

        const amountOut = BigInt(tradeQuote.quote);
        const amountOutMin = calculateAmountOutMin(amountOut, ctx.slippage);
        const calldata = await Promise.all([
            encodeDexQuote(
                dex.chain,
                router.address,
                tradeAmountIn,
                amountOutMin,
                tradeQuote.data,
            ),
            ...(msgFeeEthQuote !== undefined
                ? [
                      encodeDexQuote(
                          dex.chain,
                          router.address,
                          BigInt(msgFeeEthQuote.quote),
                          msgFee[0],
                          msgFeeEthQuote.data,
                      ),
                  ]
                : []),
        ]);
        routerCalls.push(...dexCalldataToRouterCalls(calldata));

        const approvalCall = await driver.buildApprovalCall(
            bridge,
            router.address,
            amountOut,
            ctx.signer,
        );
        if (approvalCall?.data !== undefined) {
            routerCalls.push({
                target: approvalCall.to,
                value: "0",
                callData: approvalCall.data,
            });
        }

        bridgeInput = amountOutMin;
        outputTokenAddress = dex.tokenOut;
    } else {
        const approvalCall = await driver.buildApprovalCall(
            bridge,
            router.address,
            ctx.assetAmount,
            ctx.signer,
        );
        if (approvalCall?.data !== undefined) {
            routerCalls.push({
                target: approvalCall.to,
                value: 0n,
                callData: approvalCall.data,
            });
        }
        bridgeInput = ctx.assetAmount;
        outputTokenAddress = ctx.tokenAddress;
    }

    const { sendParam, minAmount, msgFee } = await driver.quoteSend(
        quoteContract,
        bridge,
        ctx.recipient,
        bridgeInput,
        quoteOptions,
    );
    const amountLdWithSlippage = calculateAmountOutMin(minAmount, ctx.slippage);

    const claimSignature = await signErc20ClaimToRouter(
        ctx.signer,
        ctx.erc20Swap,
        ctx.chainId,
        ctx.preimage,
        ctx.assetAmount,
        ctx.tokenAddress,
        ctx.refundAddress,
        ctx.timeoutBlockHeight,
        router.address,
    );

    const tx = await driver.populateRouterClaimBridgeTransaction({
        router,
        signer: ctx.signer,
        chainId: ctx.chainId,
        preimage: ctx.preimage,
        claimAmount: ctx.assetAmount,
        claimTokenAddress: ctx.tokenAddress,
        refundAddress: ctx.refundAddress,
        timeoutBlockHeight: ctx.timeoutBlockHeight,
        claimSignature,
        route: bridge,
        bridgeContract,
        outputTokenAddress,
        routerCalls,
        sendParam,
        minAmountLd: amountLdWithSlippage,
        lzTokenFee: msgFee[1],
    });

    return sendPopulatedTransaction(
        GasAbstractionType.Signer,
        ctx.signer,
        tx as PopulatedEvmTransaction,
    );
};

const claimViaRouterDex = async <A extends string>(
    ctx: RouterClaimContext<A>,
    dex: { chain: string; tokenIn: string; tokenOut: string },
): Promise<Hash> => {
    const router = createRouterContract(ctx.asset, ctx.signer);

    const [tradeQuote] = await quoteDexAmountIn(
        dex.chain,
        dex.tokenIn,
        dex.tokenOut,
        ctx.assetAmount,
    );
    const amountOutMin = calculateAmountOutMin(
        BigInt(tradeQuote.quote),
        ctx.slippage,
    );
    const finalToken = dex.tokenOut;

    const calldata = await encodeDexQuote(
        dex.chain,
        router.address,
        ctx.assetAmount,
        amountOutMin,
        tradeQuote.data,
    );
    const routerCalls = dexCalldataToRouterCalls([calldata]);

    const [claimSignature, routerSignature] = await Promise.all([
        signErc20ClaimToRouter(
            ctx.signer,
            ctx.erc20Swap,
            ctx.chainId,
            ctx.preimage,
            ctx.assetAmount,
            ctx.tokenAddress,
            ctx.refundAddress,
            ctx.timeoutBlockHeight,
            router.address,
        ),
        signRouterClaim(
            ctx.signer,
            router.address,
            ctx.chainId,
            ctx.preimage,
            finalToken,
            amountOutMin,
            ctx.recipient,
        ),
    ]);

    const tx = encodeRouterClaimExecuteTx({
        router,
        preimage: ctx.preimage,
        amount: ctx.assetAmount,
        tokenAddress: ctx.tokenAddress,
        refundAddress: ctx.refundAddress,
        timeoutBlockHeight: ctx.timeoutBlockHeight,
        claimSignature,
        routerCalls,
        finalToken,
        minAmountOut: amountOutMin,
        destination: ctx.recipient,
        routerSignature,
    });

    return sendPopulatedTransaction(GasAbstractionType.Signer, ctx.signer, tx);
};

export const executeRoute = async <A extends string = string>(
    args: RouteExecuteArgs<A>,
): Promise<RouteExecuteResult> => {
    const { createdSwap, plan, preimage, signer, recipient } = args;
    const asset = plan.chainSwap.to;
    const slippage = args.slippage ?? getConfiguredDefaultSlippage();

    if (plan.dex === undefined && plan.bridge === undefined) {
        if (!isEvmAsset(asset)) {
            throw new Error(
                `route.execute plain path requires an EVM destination, got "${asset}"`,
            );
        }
        const claimAddress =
            createdSwap.claimDetails.claimAddress ?? signer.address;
        if (
            getKindForAsset(asset) === AssetKind.EVMNative &&
            !isAddressEqual(getAddress(claimAddress), getAddress(recipient))
        ) {
            throw new Error(
                `route.execute cannot forward native EVM asset "${asset}" to a different recipient`,
            );
        }
        const result = await executeChainSwap({
            createdSwap,
            to: asset,
            preimage,
            claimAddress,
            destination: recipient,
            signer,
        });
        return { claimTransactionId: result.claimTransactionId };
    }

    if (!isEvmAsset(asset) || getKindForAsset(asset) === AssetKind.EVMNative) {
        throw new Error(
            `route.execute requires an ERC20 via-asset, got "${asset}"`,
        );
    }

    const refundAddress =
        args.refundAddress ?? createdSwap.claimDetails.refundAddress;
    if (refundAddress === undefined) {
        throw new Error(
            `chain swap claim details for ${asset} are missing a refundAddress`,
        );
    }

    const { erc20Swap } = await buildSwapContractsForAsset(asset, signer);
    const ctx: RouterClaimContext<A> = {
        asset,
        assetAmount: satsToAssetAmount(createdSwap.claimDetails.amount, asset),
        tokenAddress: getTokenAddress(asset),
        chainId: BigInt(await signer.provider.getChainId()),
        preimage,
        refundAddress,
        timeoutBlockHeight: createdSwap.claimDetails.timeoutBlockHeight,
        recipient,
        slippage,
        signer,
        erc20Swap,
    };

    let claimTransactionId: string;
    if (plan.bridge !== undefined) {
        claimTransactionId = await claimViaRouterBridge(
            ctx,
            plan.dex,
            plan.bridge,
        );
    } else if (plan.dex !== undefined) {
        claimTransactionId = await claimViaRouterDex(ctx, plan.dex);
    } else {
        throw new Error("route has no DEX or bridge leg");
    }

    return { claimTransactionId };
};
