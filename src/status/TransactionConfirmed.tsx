import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import { Signature, type Wallet } from "ethers";
import log from "loglevel";
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
import { relayClaimTransaction } from "../rif/Signer";
import { type EncodedHop } from "../utils/Pair";
import { encodeDexQuote, quoteDexAmountIn } from "../utils/boltzClient";
import { formatError } from "../utils/errors";
import { prefix0x, satsToAssetAmount, slippageLimit } from "../utils/rootstock";
import {
    type ChainSwap,
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
) => {
    if (hops.length !== 1) {
        throw new Error("only one hop is supported for now");
    }

    const hop = hops[0];
    const amountIn = BigInt(satsToAssetAmount(amount, asset));

    // TODO: handle slippage and don't just get a new quote
    const quote = (
        await quoteDexAmountIn(
            hop.dexDetails.chain,
            hop.dexDetails.tokenIn,
            hop.dexDetails.tokenOut,
            amountIn,
        )
    )[0];
    log.info(`Got quote: ${quote.quote}`, quote.data);

    // TODO: custom slippage
    const amountOutMin = BigInt(
        Math.floor(Number(quote.quote) * (1 - slippageLimit)),
    );

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
                version: "5",
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

    const transactionHash = await sendTransaction(
        signer() as Wallet,
        chainId,
        [{ to: tx.to, data: tx.data }],
    );

    return {
        hash: transactionHash,
        quoteAmount: Number(quote.quote),
    };
};

const AutoClaimHops = (props: {
    amount: number;
    swapId: string;
    useGasAbstraction: boolean;
    preimage: string;
    assetReceive: string;
    signerAddress: string;
    refundAddress: string;
    timeoutBlockHeight: number;
    hops: EncodedHop[];
}) => {
    const { getErc20Swap, signer, gasAbstractionSigner } = useWeb3Signer();
    const { t, notify, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    const [error, setError] = createSignal<string | undefined>(undefined);

    onMount(async () => {
        try {
            const currentSwap = await getSwap(props.swapId);
            const result = await claimHops(
                props.hops,
                props.assetReceive,
                props.preimage,
                props.amount,
                props.refundAddress,
                props.timeoutBlockHeight,
                props.signerAddress,
                props.useGasAbstraction ? gasAbstractionSigner : signer,
                getErc20Swap(props.assetReceive),
            );

            currentSwap.claimTx = result.hash;
            currentSwap.dexQuoteAmount = result.quoteAmount;
            setSwap(currentSwap);
            await setSwapStorage(currentSwap);
        } catch (e) {
            log.error("Auto claim hops failed", e);
            const msg = `Transaction failed: ${formatError(e)}`;
            notify("error", msg);
            setError(msg);
        }
    });

    return (
        <Show when={!error()} fallback={<p>{error()}</p>}>
            <p>{t("tx_ready_to_claim")}</p>
            <LoadingSpinner />
        </Show>
    );
};

// TODO: use bignumber for amounts
const ClaimEvm = (props: {
    amount: number;
    swapId: string;
    useGasAbstraction: boolean;
    preimage: string;
    assetReceive: string;
    signerAddress: string;
    refundAddress: string;
    derivationPath: string;
    timeoutBlockHeight: number;
    finalReceive: string;
    hops?: EncodedHop[];
}) => {
    const { getEtherSwap, getErc20Swap, signer } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    return (
        <Show
            when={props.hops === undefined || props.hops.length === 0}
            fallback={
                <AutoClaimHops
                    swapId={props.swapId}
                    useGasAbstraction={props.useGasAbstraction}
                    preimage={props.preimage}
                    signerAddress={props.signerAddress}
                    amount={props.amount}
                    refundAddress={props.refundAddress}
                    timeoutBlockHeight={props.timeoutBlockHeight}
                    assetReceive={props.assetReceive}
                    hops={props.hops}
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
                        assetReceive={chain.assetReceive}
                        hops={chain.hops}
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
                    assetReceive={reverse.assetReceive}
                    hops={reverse.hops}
                    finalReceive={getFinalAssetReceive(reverse, true)}
                />
            </Show>
        </Show>
    );
};

export default TransactionConfirmed;
