import BigNumber from "bignumber.js";
import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import {
    AbiCoder,
    Signature,
    type Wallet,
    ZeroAddress,
    keccak256,
} from "ethers";
import log from "loglevel";
import { ImArrowDown } from "solid-icons/im";
import { type Accessor, Show, createSignal, onMount } from "solid-js";

import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import {
    AssetKind,
    getKindForAsset,
    getTokenAddress,
    isEvmAsset,
} from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { type Router } from "../consts/abis/router/Router";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    type Signer,
    createRouterContract,
    useWeb3Signer,
} from "../context/Web3";
import type { DictKey } from "../i18n/i18n";
import { relayClaimTransaction } from "../rif/Signer";
import { type EncodedHop } from "../utils/Pair";
import {
    encodeDexQuote,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "../utils/boltzClient";
import { calculateAmountWithSlippage } from "../utils/calculate";
import { formatAmount, getDecimals } from "../utils/denomination";
import { formatError } from "../utils/errors";
import {
    getSignerForGasAbstraction,
    sendPopulatedTransaction,
} from "../utils/evmTransaction";
import {
    createOftContract,
    getOftContract,
    quoteOftReceiveAmount,
    quoteOftSend,
} from "../utils/oft/oft";
import {
    type ClaimQuote,
    type DexQuote,
    fetchDexQuote,
    fetchGasTokenQuote,
} from "../utils/qouter";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    type ChainSwap,
    type DexDetail,
    GasAbstractionType,
    type OftDetail,
    type ReverseSwap,
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

type ClaimResult = {
    transactionHash: string;
    receiveAmount: bigint;
};

const calculateAmountOutMin = (
    quoteAmount: bigint,
    slippage: number,
): bigint => {
    const amountWithSlippage = calculateAmountWithSlippage(
        quoteAmount,
        slippage,
    );
    const slippageAmount = amountWithSlippage - quoteAmount;
    return quoteAmount - slippageAmount;
};

const parsePersistedQuoteAmount = (quoteAmount: number | string): bigint => {
    if (typeof quoteAmount === "string") {
        return BigInt(quoteAmount);
    }

    return BigInt(Math.round(quoteAmount));
};

const getAcceptedQuoteAmount = async (
    amount: number,
    assetReceive: string,
    hop: EncodedHop,
    quote: ClaimQuote,
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
    const initialOftQuote = await quoteOftReceiveAmount(
        oft.sourceAsset,
        oft.destinationChainId,
        quote.trade.amountOut,
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
    const adjustedOftQuote = await quoteOftReceiveAmount(
        oft.sourceAsset,
        oft.destinationChainId,
        adjustedTradeQuote.trade.amountOut,
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

// TODO: get gas tokens at destination
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

    const sourceChainId = config.assets?.[oft.sourceAsset]?.network?.chainId;
    if (sourceChainId === undefined) {
        throw new Error(
            `missing OFT source chain id for asset: ${oft.sourceAsset}`,
        );
    }

    const oftContract = await getOftContract(sourceChainId);
    if (oftContract === undefined) {
        throw new Error(`missing OFT contract for chain: ${sourceChainId}`);
    }

    const router = createRouterContract(asset, signer);
    const assetAmount = satsToAssetAmount(amount, asset);
    const tokenAddress = getTokenAddress(asset);
    const [routerAddress, { chainId }] = await Promise.all([
        router.getAddress(),
        signer.provider.getNetwork(),
    ]);
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

    const oftInstance = createOftContract(oftContract.address, signer);
    const { msgFee } = await quoteOftSend(
        oftInstance,
        oft.destinationChainId,
        destination,
        quote.trade.amountOut,
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

    const amountOutMin = calculateAmountOutMin(
        BigInt(tradeQuote.quote),
        slippage,
    );
    const { sendParam } = await quoteOftSend(
        oftInstance,
        oft.destinationChainId,
        destination,
        amountOutMin,
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
        calldata.flatMap(({ calls }) =>
            calls.map((call) => ({
                target: call.to,
                value: call.value,
                callData: prefix0x(call.data),
            })),
        ),
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
    const gasToken = await fetchGasTokenQuote({
        chain,
        tokenIn: finalToken,
        tokenOut: finalToken,
    });

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

export const claimAsset = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    claimAddress: string,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    slippage: number,
    signer: Accessor<Signer>,
    getGasAbstractionSigner: (asset: string) => Wallet,
    etherSwap: EtherSwap,
    erc20Swap: ERC20Swap,
    getGasToken: boolean,
): Promise<ClaimResult> => {
    const assetAmount = satsToAssetAmount(amount, asset);

    switch (gasAbstraction) {
        case GasAbstractionType.RifRelay:
            return {
                transactionHash: await relayClaimTransaction(
                    signer(),
                    etherSwap,
                    preimage,
                    amount,
                    refundAddress,
                    timeoutBlockHeight,
                ),
                receiveAmount: assetAmount,
            };

        case GasAbstractionType.None:
        case GasAbstractionType.Signer: {
            const claimSigner = getSignerForGasAbstraction(
                gasAbstraction,
                signer(),
                getGasAbstractionSigner(asset),
            );

            if (getKindForAsset(asset) !== AssetKind.EVMNative && getGasToken) {
                const execution = await getGasTokenRouterClaimExecution(
                    asset,
                    amount,
                    destination,
                );
                return {
                    transactionHash: await claimErc20ViaRouter(
                        gasAbstraction,
                        asset,
                        preimage,
                        amount,
                        refundAddress,
                        timeoutBlockHeight,
                        destination,
                        claimSigner,
                        erc20Swap,
                        slippage,
                        execution,
                    ),
                    receiveAmount: execution.minAmountOut,
                };
            }

            const tx =
                getKindForAsset(asset) === AssetKind.EVMNative
                    ? await (etherSwap.connect(claimSigner) as EtherSwap)[
                          "claim(bytes32,uint256,address,address,uint256)"
                      ].populateTransaction(
                          prefix0x(preimage),
                          assetAmount,
                          claimAddress,
                          refundAddress,
                          timeoutBlockHeight,
                      )
                    : await (erc20Swap.connect(claimSigner) as ERC20Swap)[
                          "claim(bytes32,uint256,address,address,address,uint256)"
                      ].populateTransaction(
                          prefix0x(preimage),
                          assetAmount,
                          getTokenAddress(asset),
                          claimAddress,
                          refundAddress,
                          timeoutBlockHeight,
                      );

            return {
                transactionHash: await sendPopulatedTransaction(
                    gasAbstraction,
                    claimSigner,
                    tx,
                ),
                receiveAmount: assetAmount,
            };
        }

        default: {
            const exhaustiveCheck: never = gasAbstraction;
            throw new Error(
                `Unsupported gas abstraction type: ${String(exhaustiveCheck)}`,
            );
        }
    }
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
            const claimSigner = getSignerForGasAbstraction(
                props.gasAbstraction,
                signer(),
                getGasAbstractionSigner(props.assetReceive),
            );

            const transactionHash = await claimHops(
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
                props.oft,
            );

            currentSwap.claimTx = transactionHash;
            currentSwap.dex.quoteAmount = quote.amount.toString();
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

    onMount(async () => {
        try {
            const hop = getSingleClaimHop(props.dex.hops);
            const amountIn = satsToAssetAmount(
                props.amount,
                props.assetReceive,
            );
            const quote = await fetchDexQuote(
                hop.dexDetails,
                amountIn,
                props.getGasToken,
            );
            const quoteAmount = await getAcceptedQuoteAmount(
                props.amount,
                props.assetReceive,
                hop,
                quote,
                props.oft,
            );
            const freshQuoteData = {
                quote,
                amount: quoteAmount,
            };
            setFreshQuote(freshQuoteData);

            if (!isOutsideSlippage(quoteAmount)) {
                // Within slippage tolerance, auto-claim
                await executeClaim(freshQuoteData);
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
    });

    return (
        <Show when={!error()} fallback={<p>{error()}</p>}>
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
        const { transactionHash, receiveAmount } = await claimAsset(
            props.gasAbstraction,
            props.assetReceive,
            props.preimage,
            props.amount,
            props.claimAddress,
            props.refundAddress,
            props.timeoutBlockHeight,
            props.signerAddress,
            slippage(),
            signer,
            getGasAbstractionSigner,
            getEtherSwap(props.assetReceive),
            getErc20Swap(props.assetReceive),
            props.getGasToken,
        );

        currentSwap.claimTx = transactionHash;
        currentSwap.receiveAmount = Number(receiveAmount.toString());
        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
    };

    onMount(async () => {
        if (claimableWithoutInteraction()) {
            await claimWithoutHops();
        }
    });

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
    const { swap } = usePayContext();

    const chain = swap() as ChainSwap;
    const reverse = swap() as ReverseSwap;

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
                        gasAbstraction={chain.gasAbstraction}
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
                        dex={chain.dex}
                        finalReceive={getFinalAssetReceive(chain, true)}
                        getGasToken={chain.getGasToken}
                        oft={chain.oft}
                    />
                }>
                <ClaimEvm
                    swapId={reverse.id}
                    gasAbstraction={reverse.gasAbstraction}
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
                    dex={reverse.dex}
                    oft={reverse.oft}
                    finalReceive={getFinalAssetReceive(reverse, true)}
                    getGasToken={reverse.getGasToken}
                />
            </Show>
        </Show>
    );
};

export default TransactionConfirmed;
