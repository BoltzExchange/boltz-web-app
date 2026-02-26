import BigNumber from "bignumber.js";
import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import { Signature, type Wallet } from "ethers";
import log from "loglevel";
import { ImArrowDown } from "solid-icons/im";
import { type Accessor, Show, createSignal, onMount } from "solid-js";

import { sendTransaction } from "../alchemy/Alchemy";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import {
    AssetKind,
    getKindForAsset,
    getTokenAddress,
    isEvmAsset,
} from "../consts/Assets";
import { SwapType } from "../consts/Enums";
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
import { encodeDexQuote, quoteDexAmountIn } from "../utils/boltzClient";
import { formatAmount, getDecimals } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    type ChainSwap,
    type DexDetail,
    type ReverseSwap,
    getFinalAssetReceive,
} from "../utils/swapCreator";

const claimAssset = async (
    useGasAbstraction: boolean,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    signer: Accessor<Signer>,
    etherSwap: EtherSwap,
    erc20Swap: ERC20Swap,
) => {
    let transactionHash: string;

    if (useGasAbstraction) {
        transactionHash = await relayClaimTransaction(
            signer(),
            etherSwap,
            preimage,
            amount,
            refundAddress,
            timeoutBlockHeight,
        );
    } else {
        const assetAmount = satsToAssetAmount(amount, asset);

        if (getKindForAsset(asset) === AssetKind.EVMNative) {
            transactionHash = (
                await etherSwap["claim(bytes32,uint256,address,uint256)"](
                    prefix0x(preimage),
                    assetAmount,
                    refundAddress,
                    timeoutBlockHeight,
                )
            ).hash;
        } else {
            transactionHash = (
                await erc20Swap[
                    "claim(bytes32,uint256,address,address,uint256)"
                ](
                    prefix0x(preimage),
                    assetAmount,
                    getTokenAddress(asset),
                    refundAddress,
                    timeoutBlockHeight,
                )
            ).hash;
        }
    }

    return transactionHash;
};

type DexQuote = {
    quoteAmount: number;
    data: unknown;
};

const fetchDexQuote = async (
    hop: EncodedHop,
    amountIn: bigint,
): Promise<DexQuote> => {
    const quote = (
        await quoteDexAmountIn(
            hop.dexDetails.chain,
            hop.dexDetails.tokenIn,
            hop.dexDetails.tokenOut,
            amountIn,
        )
    )[0];
    log.info(`Got quote: ${quote.quote}`, quote.data);
    return {
        quoteAmount: Number(quote.quote),
        data: quote.data,
    };
};

const claimHops = async (
    hops: EncodedHop[],
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    signer: Accessor<Signer | Wallet>,
    erc20Swap: ERC20Swap,
    slippage: number,
    quote: DexQuote,
) => {
    if (hops.length !== 1) {
        throw new Error("only one hop is supported for now");
    }

    const hop = hops[0];
    const amountIn = BigInt(satsToAssetAmount(amount, asset));

    const amountOutMin = BigInt(Math.floor(quote.quoteAmount * (1 - slippage)));

    const router = createRouterContract(asset, signer());

    const calldata = await encodeDexQuote(
        hop.dexDetails.chain,
        await router.getAddress(),
        amountIn,
        amountOutMin,
        quote.data,
    );

    const isEtherSwap = getKindForAsset(asset) === AssetKind.EVMNative;
    if (isEtherSwap) {
        throw new Error("EtherSwap is not supported for now");
    }

    const claimSignature = Signature.from(
        await signer().signTypedData(
            {
                name: "ERC20Swap",
                version: String(await erc20Swap.version()),
                verifyingContract: await erc20Swap.getAddress(),
                chainId: (await signer().provider.getNetwork()).chainId,
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
                amount: amountIn,
                tokenAddress: getTokenAddress(asset),
                refundAddress: refundAddress,
                timelock: timeoutBlockHeight,
                destination: await router.getAddress(),
            },
        ),
    );

    const routerAddress = await router.getAddress();
    const chainId = (await signer().provider.getNetwork()).chainId;
    const routerSignature = Signature.from(
        await signer().signTypedData(
            {
                name: "Router",
                version: "2",
                verifyingContract: routerAddress,
                chainId: chainId,
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
                token: hop.dexDetails.tokenOut,
                minAmountOut: amountOutMin,
                destination: destination,
            },
        ),
    );

    // Encode the calldata without executing
    const tx = await router[
        "claimERC20Execute((bytes32,uint256,address,address,uint256,uint8,bytes32,bytes32),(address,uint256,bytes)[],address,uint256,address,uint8,bytes32,bytes32)"
    ].populateTransaction(
        {
            preimage: prefix0x(preimage),
            amount: amountIn,
            tokenAddress: getTokenAddress(asset),
            refundAddress: refundAddress,
            timelock: timeoutBlockHeight,
            v: claimSignature.v,
            r: claimSignature.r,
            s: claimSignature.s,
        },
        calldata.calls.map((call) => ({
            target: call.to,
            value: call.value,
            callData: prefix0x(call.data),
        })),
        hop.dexDetails.tokenOut,
        amountOutMin,
        destination,
        routerSignature.v,
        routerSignature.r,
        routerSignature.s,
    );

    const transactionHash = await sendTransaction(signer() as Wallet, chainId, [
        { to: tx.to, data: tx.data },
    ]);

    return transactionHash;
};

const Amount = (props: { label: DictKey; amount: number; asset: string }) => {
    const isErc20 = () => getDecimals(props.asset).isErc20;
    const { t, denomination, separator } = useGlobalContext();

    return (
        <div>
            <div>{t(props.label)}</div>
            <span>
                {formatAmount(
                    new BigNumber(props.amount),
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
    useGasAbstraction: boolean;
    preimage: string;
    assetSend: string;
    assetReceive: string;
    signerAddress: string;
    refundAddress: string;
    timeoutBlockHeight: number;
    dex: DexDetail;
}) => {
    const { getErc20Swap, signer, getGasAbstractionSigner } = useWeb3Signer();
    const { t, slippage, notify, getSwap, setSwapStorage } = useGlobalContext();
    const { swap, setSwap } = usePayContext();

    const [error, setError] = createSignal<string | undefined>(undefined);
    const [loading, setLoading] = createSignal(false);
    const [freshQuote, setFreshQuote] = createSignal<DexQuote | undefined>(
        undefined,
    );
    const [quoteAccepted, setQuoteAccepted] = createSignal(false);

    const quoteThreshold = () => props.dex.quoteAmount * (1 - slippage());
    const isOutsideSlippage = (quote: DexQuote) =>
        quote.quoteAmount < quoteThreshold();

    const needsApproval = () => {
        const quote = freshQuote();
        if (quote === undefined) {
            return false;
        }

        return isOutsideSlippage(quote);
    };

    const executeClaim = async (quote: DexQuote) => {
        setLoading(true);
        try {
            const currentSwap = await getSwap(props.swapId);
            const claimSigner = props.useGasAbstraction
                ? getGasAbstractionSigner(props.assetReceive)
                : signer();

            const transactionHash = await claimHops(
                props.dex.hops,
                props.assetReceive,
                props.preimage,
                props.amount,
                props.refundAddress,
                props.timeoutBlockHeight,
                props.signerAddress,
                () => claimSigner,
                getErc20Swap(props.assetReceive),
                slippage(),
                quote,
            );

            currentSwap.claimTx = transactionHash;
            currentSwap.dex.quoteAmount = quote.quoteAmount;
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
            const hop = props.dex.hops[0];
            const amountIn = BigInt(
                satsToAssetAmount(props.amount, props.assetReceive),
            );
            const quote = await fetchDexQuote(hop, amountIn);
            setFreshQuote(quote);

            if (!isOutsideSlippage(quote)) {
                // Within slippage tolerance, auto-claim
                await executeClaim(quote);
            } else {
                log.info(
                    `DEX quote ${quote.quoteAmount} is below threshold ${quoteThreshold()} (expected ${props.dex.quoteAmount}, slippage ${slippage()})`,
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
                        amount={freshQuote().quoteAmount}
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
    useGasAbstraction: boolean;
    preimage: string;
    assetSend: string;
    assetReceive: string;
    signerAddress: string;
    refundAddress: string;
    derivationPath: string;
    timeoutBlockHeight: number;
    finalReceive: string;
    dex?: DexDetail;
}) => {
    const { getEtherSwap, getErc20Swap, signer } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

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
                    useGasAbstraction={props.useGasAbstraction}
                    preimage={props.preimage}
                    signerAddress={props.signerAddress}
                    amount={props.amount}
                    refundAddress={props.refundAddress}
                    timeoutBlockHeight={props.timeoutBlockHeight}
                    assetSend={props.assetSend}
                    assetReceive={props.assetReceive}
                    dex={props.dex}
                />
            }>
            <ContractTransaction
                asset={props.assetReceive}
                /* eslint-disable-next-line solid/reactivity */
                onClick={async () => {
                    const currentSwap = await getSwap(props.swapId);
                    const transactionHash = await claimAssset(
                        props.useGasAbstraction,
                        props.assetReceive,
                        props.preimage,
                        props.amount,
                        props.refundAddress,
                        props.timeoutBlockHeight,
                        signer,
                        getEtherSwap(props.assetReceive),
                        getErc20Swap(props.assetReceive),
                    );

                    currentSwap.claimTx = transactionHash;
                    setSwap(currentSwap);
                    await setSwapStorage(currentSwap);
                }}
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
                        useGasAbstraction={chain.useGasAbstraction}
                        preimage={chain.preimage}
                        signerAddress={chain.signer}
                        amount={chain.claimDetails.amount}
                        derivationPath={chain.derivationPath}
                        refundAddress={chain.claimDetails.refundAddress}
                        timeoutBlockHeight={
                            chain.claimDetails.timeoutBlockHeight
                        }
                        assetSend={chain.assetSend}
                        assetReceive={chain.assetReceive}
                        dex={chain.dex}
                        finalReceive={getFinalAssetReceive(chain, true)}
                    />
                }>
                <ClaimEvm
                    swapId={reverse.id}
                    useGasAbstraction={reverse.useGasAbstraction}
                    preimage={reverse.preimage}
                    amount={reverse.onchainAmount}
                    signerAddress={reverse.signer}
                    refundAddress={reverse.refundAddress}
                    derivationPath={reverse.derivationPath}
                    timeoutBlockHeight={reverse.timeoutBlockHeight}
                    assetSend={reverse.assetSend}
                    assetReceive={reverse.assetReceive}
                    dex={reverse.dex}
                    finalReceive={getFinalAssetReceive(reverse, true)}
                />
            </Show>
        </Show>
    );
};

export default TransactionConfirmed;
