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
import { calculateAmountWithSlippage } from "../utils/calculate";
import { formatAmount, getDecimals } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    type ChainSwap,
    type DexDetail,
    GasAbstractionType,
    type ReverseSwap,
    getFinalAssetReceive,
} from "../utils/swapCreator";

const getClaimSigner = (
    gasAbstraction: GasAbstractionType,
    asset: string,
    signer: Accessor<Signer>,
    getGasAbstractionSigner: (asset: string) => Wallet,
) => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay:
            return signer();

        case GasAbstractionType.Signer:
            return getGasAbstractionSigner(asset);
    }
};

const claimAsset = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    signer: Accessor<Signer>,
    getGasAbstractionSigner: (asset: string) => Wallet,
    etherSwap: EtherSwap,
    erc20Swap: ERC20Swap,
) => {
    let transactionHash: string;

    switch (gasAbstraction) {
        case GasAbstractionType.RifRelay:
            transactionHash = await relayClaimTransaction(
                signer(),
                etherSwap,
                preimage,
                amount,
                refundAddress,
                timeoutBlockHeight,
            );
            break;

        case GasAbstractionType.None:
        case GasAbstractionType.Signer: {
            const assetAmount = satsToAssetAmount(amount, asset);
            const claimSigner = getClaimSigner(
                gasAbstraction,
                asset,
                signer,
                getGasAbstractionSigner,
            );

            if (getKindForAsset(asset) === AssetKind.EVMNative) {
                transactionHash = (
                    await (etherSwap.connect(claimSigner) as EtherSwap)[
                        "claim(bytes32,uint256,address,uint256)"
                    ](
                        prefix0x(preimage),
                        assetAmount,
                        refundAddress,
                        timeoutBlockHeight,
                    )
                ).hash;
            } else {
                transactionHash = (
                    await (erc20Swap.connect(claimSigner) as ERC20Swap)[
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
            break;
        }
    }

    return transactionHash;
};

type DexQuote = {
    quoteAmount: bigint;
    data: unknown;
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
    const quoteAmount = BigInt(quote.quote);
    log.info(`Got quote: ${quoteAmount.toString()}`, quote.data);
    return {
        quoteAmount,
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

    const amountOutMin = calculateAmountOutMin(quote.quoteAmount, slippage);

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

    const quoteThreshold = () =>
        calculateAmountOutMin(
            parsePersistedQuoteAmount(props.dex.quoteAmount),
            slippage(),
        );
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
            const claimSigner = getClaimSigner(
                props.gasAbstraction,
                props.assetReceive,
                signer,
                getGasAbstractionSigner,
            );

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
            currentSwap.dex.quoteAmount = quote.quoteAmount.toString();
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
                    `DEX quote ${quote.quoteAmount.toString()} is below threshold ${quoteThreshold().toString()} (expected ${props.dex.quoteAmount.toString()}, slippage ${slippage()})`,
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
    gasAbstraction: GasAbstractionType;
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
    const { getEtherSwap, getErc20Swap, getGasAbstractionSigner, signer } =
        useWeb3Signer();
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
                    gasAbstraction={props.gasAbstraction}
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
                    const transactionHash = await claimAsset(
                        props.gasAbstraction,
                        props.assetReceive,
                        props.preimage,
                        props.amount,
                        props.refundAddress,
                        props.timeoutBlockHeight,
                        signer,
                        getGasAbstractionSigner,
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
                        gasAbstraction={chain.gasAbstraction}
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
                    gasAbstraction={reverse.gasAbstraction}
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
