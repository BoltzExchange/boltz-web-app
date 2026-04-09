import BigNumber from "bignumber.js";
import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { Router } from "boltz-core/typechain/Router";
import {
    AbiCoder,
    Signature,
    type Wallet,
    ZeroAddress,
    keccak256,
} from "ethers";
import log from "loglevel";
import { ImArrowDown } from "solid-icons/im";
import {
    type Accessor,
    Show,
    createEffect,
    createSignal,
    on,
    untrack,
} from "solid-js";

import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import {
    AssetKind,
    getKindForAsset,
    getNetworkTransport,
    getTokenAddress,
    isEvmAsset,
} from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import { swapStatusPending } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    type Signer,
    createRouterContract,
    useWeb3Signer,
} from "../context/Web3";
import type { DictKey } from "../i18n/i18n";
import type { EncodedHop } from "../utils/Pair";
import {
    encodeDexQuote,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "../utils/boltzClient";
import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
} from "../utils/calculate";
import { formatAmount, getDecimals } from "../utils/denomination";
import { formatError } from "../utils/errors";
import {
    type ClaimResult,
    claimAsset,
    getSignerForGasAbstraction,
    sendPopulatedTransaction,
} from "../utils/evmTransaction";
import {
    type OftQuoteOptions,
    buildOftApprovalCall,
    getQuotedOftContract,
    quoteOftReceiveAmount,
    quoteOftSend,
} from "../utils/oft/oft";
import { getOftContract } from "../utils/oft/registry";
import type { OftReceiveQuote } from "../utils/oft/types";
import { retryWithBackoff } from "../utils/promise";
import {
    type ClaimQuote,
    type DexQuote,
    fetchDexQuote,
    fetchGasTokenQuote,
    gasTopUpSupported,
    getGasTopUpNativeAmount,
} from "../utils/qouter";
import {
    assetAmountToSats,
    prefix0x,
    satsToAssetAmount,
} from "../utils/rootstock";
import {
    type ChainSwap,
    type DexDetail,
    GasAbstractionType,
    type OftDetail,
    type ReverseSwap,
    getClaimGasAbstraction,
    getFinalAssetReceive,
    getPostOftDetail,
} from "../utils/swapCreator";

type RouterExecutionQuote = {
    chain: string;
    recipient: string;
    quote: DexQuote;
};

type RouterClaimExecution = {
    finalToken: string;
    minAmountOut: bigint;
    quotes: RouterExecutionQuote[];
};

export const normalizePersistedReceiveAmount = (
    amount: bigint,
    asset: string,
): string => {
    if (isEvmAsset(asset) && !getDecimals(asset).isErc20) {
        return assetAmountToSats(amount, asset).toString();
    }

    return amount.toString();
};

const withAutoClaimLock = async <T,>(
    swapId: string,
    fn: () => Promise<T>,
): Promise<T | undefined> => {
    if (navigator.locks?.request === undefined) {
        return await fn();
    }

    return await navigator.locks.request(
        `transactionConfirmedAutoClaim:${swapId}`,
        { ifAvailable: true },
        async (lock) => {
            if (lock === null) {
                log.info(
                    `Skipping duplicate auto-claim execution for swap ${swapId}`,
                );
                return undefined;
            }

            return await fn();
        },
    );
};

const parsePersistedQuoteAmount = (quoteAmount: number | string): bigint => {
    if (typeof quoteAmount === "string") {
        return BigInt(quoteAmount);
    }

    return BigInt(Math.round(quoteAmount));
};

const getPostOftQuoteOptions = async (
    destinationAsset: string,
    destination: string,
    getGasToken: boolean,
): Promise<OftQuoteOptions> => ({
    recipient: destination,
    nativeDrop:
        getGasToken && gasTopUpSupported(destinationAsset)
            ? {
                  amount: await getGasTopUpNativeAmount(destinationAsset),
                  receiver: destination,
              }
            : undefined,
});

const getAcceptedQuoteAmount = async (
    amount: number,
    assetReceive: string,
    hop: EncodedHop,
    quote: ClaimQuote,
    destination: string,
    getGasToken: boolean,
    oft?: OftDetail,
): Promise<bigint> => {
    if (oft === undefined) {
        return quote.trade.amountOut;
    }

    const dexDetails = hop.dexDetails;
    if (dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    const claimAmount = satsToAssetAmount(amount, assetReceive);
    const oftQuoteOptions = await getPostOftQuoteOptions(
        oft.destinationAsset,
        destination,
        getGasToken,
    );
    const initialOftQuote = await quoteOftReceiveAmount(
        {
            from: oft.sourceAsset,
            to: oft.destinationAsset,
        },
        quote.trade.amountOut,
        oftQuoteOptions,
    );
    const [messagingFeeQuote] = await quoteDexAmountOut(
        dexDetails.chain,
        dexDetails.tokenIn,
        ZeroAddress,
        initialOftQuote.msgFee[0],
    );
    const adjustedClaimAmount = claimAmount - BigInt(messagingFeeQuote.quote);
    if (adjustedClaimAmount <= 0n) {
        throw new Error("amount too small to cover OFT messaging fee");
    }

    const adjustedTradeQuote = await fetchDexQuote(
        dexDetails,
        adjustedClaimAmount,
    );
    const adjustedOftQuote: OftReceiveQuote = await quoteOftReceiveAmount(
        {
            from: oft.sourceAsset,
            to: oft.destinationAsset,
        },
        adjustedTradeQuote.trade.amountOut,
        oftQuoteOptions,
    );

    return adjustedOftQuote.amountOut;
};

const getAssetChain = (asset: string): string => {
    const chain = config.assets?.[asset]?.network?.symbol;
    if (chain === undefined) {
        throw new Error(`missing network symbol for asset: ${asset}`);
    }

    return chain;
};

const getSingleClaimHop = (hops: EncodedHop[]): EncodedHop => {
    if (hops.length !== 1) {
        throw new Error("only one hop is supported for now");
    }

    const [hop] = hops;
    if (hop.dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    return hop;
};

const encodeRouterExecutionCalls = async (
    quotes: RouterExecutionQuote[],
    slippage: number,
) => {
    const calldata = await Promise.all(
        quotes.map(({ chain, recipient, quote }) =>
            encodeDexQuote(
                chain,
                recipient,
                quote.amountIn,
                calculateAmountOutMin(quote.amountOut, slippage),
                quote.data,
            ),
        ),
    );

    return calldata.flatMap(({ calls }) =>
        calls.map((call) => ({
            target: call.to,
            value: call.value,
            callData: prefix0x(call.data),
        })),
    );
};

export const signErc20ClaimToRouter = async (
    signer: Signer | Wallet,
    erc20Swap: ERC20Swap,
    chainId: bigint,
    preimage: string,
    amount: bigint,
    tokenAddress: string,
    refundAddress: string,
    timeoutBlockHeight: number,
    routerAddress: string,
) => {
    const connectedErc20Swap = erc20Swap.connect(signer) as ERC20Swap;
    const [version, verifyingContract] = await Promise.all([
        connectedErc20Swap.version(),
        connectedErc20Swap.getAddress(),
    ]);

    return Signature.from(
        await signer.signTypedData(
            {
                name: "ERC20Swap",
                version: String(version),
                verifyingContract,
                chainId,
            },
            {
                Claim: [
                    { name: "preimage", type: "bytes32" },
                    { name: "amount", type: "uint256" },
                    { name: "tokenAddress", type: "address" },
                    { name: "refundAddress", type: "address" },
                    { name: "timelock", type: "uint256" },
                    { name: "destination", type: "address" },
                ],
            },
            {
                preimage: prefix0x(preimage),
                amount,
                tokenAddress,
                refundAddress,
                timelock: timeoutBlockHeight,
                destination: routerAddress,
            },
        ),
    );
};

const signRouterClaim = async (
    signer: Signer | Wallet,
    routerAddress: string,
    chainId: bigint,
    preimage: string,
    finalToken: string,
    minAmountOut: bigint,
    destination: string,
) =>
    Signature.from(
        await signer.signTypedData(
            {
                name: "Router",
                version: "2",
                verifyingContract: routerAddress,
                chainId,
            },
            {
                Claim: [
                    { name: "preimage", type: "bytes32" },
                    { name: "token", type: "address" },
                    { name: "minAmountOut", type: "uint256" },
                    { name: "destination", type: "address" },
                ],
            },
            {
                preimage: prefix0x(preimage),
                token: finalToken,
                minAmountOut,
                destination,
            },
        ),
    );

const hashOftSendData = async (
    router: Router,
    sendData: {
        dstEid: number;
        to: string;
        extraOptions: string;
        composeMsg: string;
        oftCmd: string;
    },
): Promise<string> =>
    keccak256(
        AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "uint32", "bytes32", "bytes32", "bytes32", "bytes32"],
            [
                await router.TYPEHASH_SEND_DATA(),
                sendData.dstEid,
                sendData.to,
                keccak256(sendData.extraOptions),
                keccak256(sendData.composeMsg),
                keccak256(sendData.oftCmd),
            ],
        ),
    );

const claimErc20ViaRouter = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    signer: Signer | Wallet,
    erc20Swap: ERC20Swap,
    slippage: number,
    execution: RouterClaimExecution,
) => {
    if (getKindForAsset(asset) === AssetKind.EVMNative) {
        throw new Error("EtherSwap is not supported for now");
    }

    if (signer.provider === null) {
        throw new Error("router claim signer requires a provider");
    }

    const router = createRouterContract(asset, signer);
    const assetAmount = satsToAssetAmount(amount, asset);
    const tokenAddress = getTokenAddress(asset);
    const [routerAddress, { chainId }, calls] = await Promise.all([
        router.getAddress(),
        signer.provider.getNetwork(),
        encodeRouterExecutionCalls(execution.quotes, slippage),
    ]);
    const [claimSignature, routerSignature] = await Promise.all([
        signErc20ClaimToRouter(
            signer,
            erc20Swap,
            chainId,
            preimage,
            assetAmount,
            tokenAddress,
            refundAddress,
            timeoutBlockHeight,
            routerAddress,
        ),
        signRouterClaim(
            signer,
            routerAddress,
            chainId,
            preimage,
            execution.finalToken,
            execution.minAmountOut,
            destination,
        ),
    ]);

    const tx = await router[
        "claimERC20Execute((bytes32,uint256,address,address,uint256,uint8,bytes32,bytes32),(address,uint256,bytes)[],address,uint256,address,uint8,bytes32,bytes32)"
    ].populateTransaction(
        {
            preimage: prefix0x(preimage),
            amount: assetAmount,
            tokenAddress,
            refundAddress,
            timelock: timeoutBlockHeight,
            v: claimSignature.v,
            r: claimSignature.r,
            s: claimSignature.s,
        },
        calls,
        execution.finalToken,
        execution.minAmountOut,
        destination,
        routerSignature.v,
        routerSignature.r,
        routerSignature.s,
    );

    return await sendPopulatedTransaction(gasAbstraction, signer, tx);
};

const claimErc20ViaRouterOft = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    signer: Signer | Wallet,
    erc20Swap: ERC20Swap,
    slippage: number,
    hop: EncodedHop,
    quote: ClaimQuote,
    oft: OftDetail,
    getGasToken: boolean,
) => {
    if (getKindForAsset(asset) === AssetKind.EVMNative) {
        throw new Error("EtherSwap is not supported for now");
    }

    if (signer.provider === null) {
        throw new Error("router claim signer requires a provider");
    }

    const dexDetails = hop.dexDetails;
    if (dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    const oftRoute = {
        from: oft.sourceAsset,
        to: oft.destinationAsset,
    };
    const oftContract = await getOftContract(oftRoute);
    const sourceTransport = getNetworkTransport(oft.sourceAsset);
    if (sourceTransport !== NetworkTransport.Evm) {
        throw new Error(
            `OFT approvals require an EVM source contract, got ${String(sourceTransport)}`,
        );
    }

    const router = createRouterContract(asset, signer);
    const assetAmount = satsToAssetAmount(amount, asset);
    const [routerAddress, { chainId }] = await Promise.all([
        router.getAddress(),
        signer.provider.getNetwork(),
    ]);

    const oftQuoteInstance = await getQuotedOftContract({
        from: oft.sourceAsset,
        to: oft.destinationAsset,
    });
    const oftQuoteOptions = await getPostOftQuoteOptions(
        oft.destinationAsset,
        destination,
        getGasToken,
    );
    const { msgFee } = await quoteOftSend(
        oftQuoteInstance,
        oftRoute,
        destination,
        quote.trade.amountOut,
        oftQuoteOptions,
    );
    const msgFeeEthAmountOut = calculateAmountWithSlippage(msgFee[0], slippage);
    const [msgFeeEthQuote] = await quoteDexAmountOut(
        dexDetails.chain,
        dexDetails.tokenIn,
        ZeroAddress,
        msgFeeEthAmountOut,
    );
    const tradeAmountIn = assetAmount - BigInt(msgFeeEthQuote.quote);
    if (tradeAmountIn <= 0n) {
        throw new Error("amount too small to cover OFT messaging fee");
    }

    const [tradeQuote] = await quoteDexAmountIn(
        dexDetails.chain,
        dexDetails.tokenIn,
        dexDetails.tokenOut,
        tradeAmountIn,
    );

    const amountOut = BigInt(tradeQuote.quote);
    const amountOutMin = calculateAmountOutMin(amountOut, slippage);
    const { sendParam } = await quoteOftSend(
        oftQuoteInstance,
        oftRoute,
        destination,
        amountOutMin,
        oftQuoteOptions,
    );
    const amountLdWithSlippage = calculateAmountOutMin(sendParam[3], slippage);
    const sendData = {
        dstEid: sendParam[0],
        to: sendParam[1],
        extraOptions: sendParam[4],
        composeMsg: sendParam[5],
        oftCmd: sendParam[6],
    };
    const authSignature = Signature.from(
        await signer.signTypedData(
            {
                name: "Router",
                version: "2",
                verifyingContract: routerAddress,
                chainId,
            },
            {
                ClaimSend: [
                    { name: "preimage", type: "bytes32" },
                    { name: "token", type: "address" },
                    { name: "oft", type: "address" },
                    { name: "sendData", type: "bytes32" },
                    { name: "minAmountLD", type: "uint256" },
                    { name: "lzTokenFee", type: "uint256" },
                    { name: "refundAddress", type: "address" },
                ],
            },
            {
                preimage: prefix0x(preimage),
                token: dexDetails.tokenOut,
                oft: oftContract.address,
                sendData: await hashOftSendData(router, sendData),
                minAmountLD: amountLdWithSlippage,
                lzTokenFee: msgFee[1],
                refundAddress,
            },
        ),
    );

    const calldata = await Promise.all([
        encodeDexQuote(
            dexDetails.chain,
            routerAddress,
            tradeAmountIn,
            amountOutMin,
            tradeQuote.data,
        ),
        encodeDexQuote(
            dexDetails.chain,
            routerAddress,
            BigInt(msgFeeEthQuote.quote),
            msgFee[0],
            msgFeeEthQuote.data,
        ),
    ]);

    const tokenAddress = getTokenAddress(asset);
    const claimSignature = await signErc20ClaimToRouter(
        signer,
        erc20Swap,
        chainId,
        preimage,
        assetAmount,
        tokenAddress,
        refundAddress,
        timeoutBlockHeight,
        routerAddress,
    );
    const routerCalls = calldata.flatMap(({ calls }) =>
        calls.map((call) => ({
            target: call.to,
            value: call.value,
            callData: prefix0x(call.data),
        })),
    );

    const approvalCall = await buildOftApprovalCall(
        oftRoute,
        routerAddress,
        amountOut,
        signer,
    );
    if (approvalCall !== undefined) {
        routerCalls.push({
            target: approvalCall.to,
            value: "0",
            callData: approvalCall.data,
        });
    }

    const tx = await router.claimERC20ExecuteOft.populateTransaction(
        {
            preimage: prefix0x(preimage),
            amount: assetAmount,
            tokenAddress,
            refundAddress,
            timelock: timeoutBlockHeight,
            v: claimSignature.v,
            r: claimSignature.r,
            s: claimSignature.s,
        },
        routerCalls,
        dexDetails.tokenOut,
        oftContract.address,
        sendData,
        {
            minAmountLd: amountLdWithSlippage,
            lzTokenFee: msgFee[1],
            refundAddress,
            v: authSignature.v,
            r: authSignature.r,
            s: authSignature.s,
        },
    );

    return await sendPopulatedTransaction(gasAbstraction, signer, tx);
};

const getHopRouterClaimExecution = (
    hop: EncodedHop,
    routerAddress: string,
    destination: string,
    slippage: number,
    quote: ClaimQuote,
): RouterClaimExecution => {
    const dexDetails = hop.dexDetails;
    if (dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    return {
        finalToken: dexDetails.tokenOut,
        minAmountOut: calculateAmountOutMin(quote.trade.amountOut, slippage),
        quotes: [
            {
                chain: dexDetails.chain,
                recipient: routerAddress,
                quote: quote.trade,
            },
            ...(quote.gasToken === undefined
                ? []
                : [
                      {
                          chain: dexDetails.chain,
                          recipient: destination,
                          quote: quote.gasToken,
                      },
                  ]),
        ],
    };
};

const getGasTokenRouterClaimExecution = async (
    asset: string,
    amount: number,
    destination: string,
): Promise<RouterClaimExecution> => {
    const assetAmount = satsToAssetAmount(amount, asset);
    const chain = getAssetChain(asset);
    const finalToken = getTokenAddress(asset);
    const gasTokenAmount = await getGasTopUpNativeAmount(asset);
    const gasToken = await fetchGasTokenQuote(
        {
            chain,
            tokenIn: finalToken,
            tokenOut: finalToken,
        },
        gasTokenAmount,
    );

    if (gasToken.amountIn > assetAmount) {
        throw new Error("gas token quote exceeds claim amount");
    }

    return {
        finalToken,
        minAmountOut: assetAmount - gasToken.amountIn,
        quotes: [
            {
                chain,
                recipient: destination,
                quote: gasToken,
            },
        ],
    };
};

const claimHops = async (
    hops: EncodedHop[],
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    signer: Accessor<Signer | Wallet>,
    erc20Swap: ERC20Swap,
    slippage: number,
    quote: ClaimQuote,
    getGasToken: boolean,
    oft?: OftDetail,
) => {
    if (oft !== undefined) {
        return await claimErc20ViaRouterOft(
            gasAbstraction,
            asset,
            preimage,
            amount,
            refundAddress,
            timeoutBlockHeight,
            destination,
            signer(),
            erc20Swap,
            slippage,
            getSingleClaimHop(hops),
            quote,
            oft,
            getGasToken,
        );
    }

    const hop = getSingleClaimHop(hops);
    const routerAddress = await createRouterContract(
        asset,
        signer(),
    ).getAddress();
    const execution = getHopRouterClaimExecution(
        hop,
        routerAddress,
        destination,
        slippage,
        quote,
    );

    return await claimErc20ViaRouter(
        gasAbstraction,
        asset,
        preimage,
        amount,
        refundAddress,
        timeoutBlockHeight,
        destination,
        signer(),
        erc20Swap,
        slippage,
        execution,
    );
};

const Amount = (props: {
    label: DictKey;
    amount: number | string | bigint;
    asset: string;
}) => {
    const isErc20 = () => getDecimals(props.asset).isErc20;
    const { t, denomination, separator } = useGlobalContext();

    return (
        <div>
            <div>{t(props.label)}</div>
            <span>
                {formatAmount(
                    new BigNumber(props.amount.toString()),
                    denomination(),
                    separator(),
                    props.asset,
                ) || 0}
                <Show
                    when={!isErc20()}
                    fallback={
                        <span class="asset-fallback">{props.asset}</span>
                    }>
                    <span
                        class="denominator"
                        data-denominator={denomination()}
                    />
                </Show>
            </span>
        </div>
    );
};

const AutoClaimHops = (props: {
    amount: number;
    swapId: string;
    gasAbstraction: GasAbstractionType;
    preimage: string;
    assetSend: string;
    assetReceive: string;
    signerAddress: string;
    refundAddress: string;
    timeoutBlockHeight: number;
    getGasToken: boolean;
    dex: DexDetail;
    oft?: OftDetail;
    autoClaimEnabled: boolean;
}) => {
    const { getErc20Swap, signer, getGasAbstractionSigner } = useWeb3Signer();
    const { t, slippage, notify, getSwap, setSwapStorage } = useGlobalContext();
    const { swap, setSwap } = usePayContext();

    const [error, setError] = createSignal<string | undefined>(undefined);
    const [loading, setLoading] = createSignal(false);
    const [freshQuote, setFreshQuote] = createSignal<
        | {
              quote: ClaimQuote;
              amount: bigint;
          }
        | undefined
    >(undefined);
    const [quoteAccepted, setQuoteAccepted] = createSignal(false);

    const quoteThreshold = () =>
        calculateAmountOutMin(
            parsePersistedQuoteAmount(props.dex.quoteAmount),
            slippage(),
        );
    const isOutsideSlippage = (quoteAmount: bigint) =>
        quoteAmount < quoteThreshold();

    const needsApproval = () => {
        const quote = freshQuote();
        if (quote === undefined) {
            return false;
        }

        return isOutsideSlippage(quote.amount);
    };

    const executeClaim = async (quote: {
        quote: ClaimQuote;
        amount: bigint;
    }) => {
        setLoading(true);
        try {
            const currentSwap = await getSwap(props.swapId);
            if (currentSwap === null) {
                log.warn(
                    `Skipping auto claim hops for missing swap ${props.swapId}`,
                );
                return;
            }
            if (currentSwap.dex === undefined) {
                log.warn(
                    `Skipping auto claim hops without DEX data for ${props.swapId}`,
                );
                return;
            }

            const claimSigner = getSignerForGasAbstraction(
                props.gasAbstraction,
                signer(),
                getGasAbstractionSigner(props.assetReceive),
            );

            const maxRetries = 3;
            const baseDelayMs = 2_000;
            const transactionHash = await retryWithBackoff(
                // eslint-disable-next-line solid/reactivity
                () =>
                    claimHops(
                        props.dex.hops,
                        props.gasAbstraction,
                        props.assetReceive,
                        props.preimage,
                        props.amount,
                        props.refundAddress,
                        props.timeoutBlockHeight,
                        props.signerAddress,
                        () => claimSigner,
                        getErc20Swap(props.assetReceive),
                        slippage(),
                        quote.quote,
                        props.getGasToken,
                        props.oft,
                    ),
                maxRetries,
                baseDelayMs,
            );

            currentSwap.claimTx = transactionHash;
            currentSwap.dex.quoteAmount = normalizePersistedReceiveAmount(
                quote.amount,
                getFinalAssetReceive(currentSwap),
            );

            setSwap(currentSwap);
            await setSwapStorage(currentSwap);
        } catch (e) {
            log.error("Auto claim hops failed", e);
            const msg = `Transaction failed: ${formatError(e)}`;
            notify("error", msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    createEffect(
        on(
            () => props.autoClaimEnabled,
            async (autoClaimEnabled) => {
                if (!autoClaimEnabled) {
                    return;
                }

                try {
                    const hop = getSingleClaimHop(props.dex.hops);
                    const amountIn = satsToAssetAmount(
                        props.amount,
                        props.assetReceive,
                    );
                    const useDexGasToken =
                        props.oft === undefined &&
                        props.getGasToken &&
                        gasTopUpSupported(props.assetReceive);
                    const quote = await fetchDexQuote(
                        hop.dexDetails,
                        amountIn,
                        useDexGasToken,
                        useDexGasToken
                            ? await getGasTopUpNativeAmount(props.assetReceive)
                            : undefined,
                    );
                    const quoteAmount = await getAcceptedQuoteAmount(
                        props.amount,
                        props.assetReceive,
                        hop,
                        quote,
                        props.signerAddress,
                        props.getGasToken,
                        props.oft,
                    );
                    const freshQuoteData = {
                        quote,
                        amount: quoteAmount,
                    };
                    setFreshQuote(freshQuoteData);

                    if (!isOutsideSlippage(quoteAmount)) {
                        // Within slippage tolerance, auto-claim
                        await withAutoClaimLock(props.swapId, async () => {
                            await untrack(() => executeClaim(freshQuoteData));
                        });
                    } else {
                        log.info(
                            `Claim quote ${quoteAmount.toString()} is below threshold ${quoteThreshold().toString()} (expected ${props.dex.quoteAmount.toString()}, slippage ${slippage()})`,
                        );
                    }
                } catch (e) {
                    log.error("Auto claim hops failed", e);
                    const msg = `Transaction failed: ${formatError(e)}`;
                    notify("error", msg);
                    setError(msg);
                }
            },
        ),
    );

    return (
        <Show
            when={!error()}
            fallback={
                <div class="error-container">
                    <p>{error()}</p>
                    <button
                        class="btn btn-primary"
                        onClick={async () => {
                            setError(undefined);
                            await executeClaim(freshQuote()!);
                        }}>
                        {t("retry")}
                    </button>
                </div>
            }>
            <Show
                when={
                    freshQuote() !== undefined &&
                    needsApproval() &&
                    !quoteAccepted()
                }
                fallback={
                    <Show
                        when={loading()}
                        fallback={
                            <>
                                <p>{t("tx_ready_to_claim")}</p>
                                <LoadingSpinner />
                            </>
                        }>
                        <LoadingSpinner />
                    </Show>
                }>
                <h2>{t("dex_quote_changed")}</h2>
                <div class="quote">
                    <Amount
                        label={"sent"}
                        amount={swap().sendAmount}
                        asset={props.assetSend}
                    />
                    <ImArrowDown size={15} style={{ opacity: 0.5 }} />
                    <Amount
                        label={"will_receive"}
                        amount={freshQuote().amount}
                        asset={getFinalAssetReceive(swap(), true)}
                    />
                </div>

                <div class="btns btns-space-between">
                    <button
                        class="btn btn-success"
                        disabled={loading()}
                        onClick={async () => {
                            setQuoteAccepted(true);
                            await executeClaim(freshQuote());
                        }}>
                        {loading() ? (
                            <LoadingSpinner class="inner-spinner" />
                        ) : (
                            t("accept")
                        )}
                    </button>
                </div>
            </Show>
        </Show>
    );
};

// TODO: use bignumber for amounts
const ClaimEvm = (props: {
    amount: number;
    swapId: string;
    gasAbstraction: GasAbstractionType;
    preimage: string;
    assetSend: string;
    assetReceive: string;
    signerAddress: string;
    claimAddress: string;
    refundAddress: string;
    derivationPath: string;
    timeoutBlockHeight: number;
    finalReceive: string;
    getGasToken: boolean;
    dex?: DexDetail;
    oft?: OftDetail;
    autoClaimEnabled: boolean;
}) => {
    const { getEtherSwap, getErc20Swap, getGasAbstractionSigner, signer } =
        useWeb3Signer();
    const { t, slippage, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    const claimableWithoutInteraction = () =>
        props.gasAbstraction === GasAbstractionType.Signer;

    const claimWithoutHops = async () => {
        // Ignore swaps with dex hops here
        if (props.dex !== undefined || props.dex?.hops?.length > 0) {
            return;
        }

        const currentSwap = await getSwap(props.swapId);

        let result: ClaimResult;

        if (
            getKindForAsset(props.assetReceive) !== AssetKind.EVMNative &&
            props.getGasToken &&
            gasTopUpSupported(props.assetReceive)
        ) {
            const claimSigner = getSignerForGasAbstraction(
                props.gasAbstraction,
                signer(),
                getGasAbstractionSigner(props.assetReceive),
            );
            const execution = await getGasTokenRouterClaimExecution(
                props.assetReceive,
                props.amount,
                props.signerAddress,
            );
            result = {
                transactionHash: await claimErc20ViaRouter(
                    props.gasAbstraction,
                    props.assetReceive,
                    props.preimage,
                    props.amount,
                    props.refundAddress,
                    props.timeoutBlockHeight,
                    props.signerAddress,
                    claimSigner,
                    getErc20Swap(props.assetReceive),
                    slippage(),
                    execution,
                ),
                receiveAmount: execution.minAmountOut,
            };
        } else {
            result = await claimAsset(
                props.gasAbstraction,
                props.assetReceive,
                props.preimage,
                props.amount,
                props.claimAddress,
                props.refundAddress,
                props.timeoutBlockHeight,
                props.signerAddress,
                signer,
                getGasAbstractionSigner(props.assetReceive),
                getEtherSwap(props.assetReceive),
                getErc20Swap(props.assetReceive),
            );
        }

        const { transactionHash, receiveAmount } = result;

        currentSwap.claimTx = transactionHash;
        currentSwap.receiveAmount = Number(
            normalizePersistedReceiveAmount(
                receiveAmount,
                getFinalAssetReceive(currentSwap),
            ),
        );
        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
    };

    createEffect(
        on(
            () => props.autoClaimEnabled,
            async (autoClaimEnabled) => {
                if (autoClaimEnabled && claimableWithoutInteraction()) {
                    await withAutoClaimLock(props.swapId, async () => {
                        await untrack(() => claimWithoutHops());
                    });
                }
            },
        ),
    );

    return (
        <Show
            when={
                props.dex === undefined ||
                props.dex.hops === undefined ||
                props.dex.hops.length === 0
            }
            fallback={
                <AutoClaimHops
                    swapId={props.swapId}
                    gasAbstraction={props.gasAbstraction}
                    preimage={props.preimage}
                    signerAddress={props.signerAddress}
                    amount={props.amount}
                    refundAddress={props.refundAddress}
                    timeoutBlockHeight={props.timeoutBlockHeight}
                    assetSend={props.assetSend}
                    assetReceive={props.assetReceive}
                    getGasToken={props.getGasToken}
                    dex={props.dex}
                    oft={getPostOftDetail(props.oft)}
                    autoClaimEnabled={props.autoClaimEnabled}
                />
            }>
            <Show
                when={!claimableWithoutInteraction()}
                fallback={<LoadingSpinner />}>
                <ContractTransaction
                    asset={props.assetReceive}
                    onClick={claimWithoutHops}
                    address={{
                        address: props.signerAddress,
                        derivationPath: props.derivationPath,
                    }}
                    buttonText={t("continue")}
                    promptText={t("transaction_prompt_receive", {
                        button: t("continue"),
                        asset: props.finalReceive,
                    })}
                    waitingText={t("tx_ready_to_claim")}
                />
            </Show>
        </Show>
    );
};

const TransactionConfirmed = () => {
    const { t } = useGlobalContext();
    const { swap, swapStatus } = usePayContext();

    const chain = swap() as ChainSwap;
    const reverse = swap() as ReverseSwap;

    const dexToClaim = (dex?: DexDetail) => {
        if (dex?.position === SwapPosition.Post) {
            return dex;
        }

        return undefined;
    };

    return (
        <Show
            when={isEvmAsset(swap().assetReceive)}
            fallback={
                <div>
                    <h2>{t("tx_confirmed")}</h2>
                    <p>{t("tx_ready_to_claim")}</p>
                    <LoadingSpinner />
                </div>
            }>
            <Show
                when={swap().type !== SwapType.Chain}
                fallback={
                    <ClaimEvm
                        swapId={chain.id}
                        gasAbstraction={getClaimGasAbstraction(chain)}
                        preimage={chain.preimage}
                        signerAddress={
                            chain.originalDestination || chain.signer
                        }
                        amount={chain.claimDetails.amount}
                        derivationPath={chain.derivationPath}
                        claimAddress={chain.claimAddress}
                        refundAddress={chain.claimDetails.refundAddress}
                        timeoutBlockHeight={
                            chain.claimDetails.timeoutBlockHeight
                        }
                        assetSend={chain.assetSend}
                        assetReceive={chain.assetReceive}
                        dex={dexToClaim(chain.dex)}
                        finalReceive={getFinalAssetReceive(chain, true)}
                        getGasToken={chain.getGasToken}
                        oft={chain.oft}
                        autoClaimEnabled={
                            swapStatus() ===
                            swapStatusPending.TransactionServerConfirmed
                        }
                    />
                }>
                <ClaimEvm
                    swapId={reverse.id}
                    gasAbstraction={getClaimGasAbstraction(reverse)}
                    preimage={reverse.preimage}
                    amount={reverse.onchainAmount}
                    signerAddress={
                        reverse.originalDestination || reverse.signer
                    }
                    claimAddress={reverse.claimAddress}
                    refundAddress={reverse.refundAddress}
                    derivationPath={reverse.derivationPath}
                    timeoutBlockHeight={reverse.timeoutBlockHeight}
                    assetSend={reverse.assetSend}
                    assetReceive={reverse.assetReceive}
                    dex={dexToClaim(reverse.dex)}
                    oft={reverse.oft}
                    finalReceive={getFinalAssetReceive(reverse, true)}
                    getGasToken={reverse.getGasToken}
                    autoClaimEnabled={true}
                />
            </Show>
        </Show>
    );
};

export default TransactionConfirmed;
