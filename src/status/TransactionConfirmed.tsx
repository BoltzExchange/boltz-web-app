import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import { Signature } from "ethers";
import log from "loglevel";
import { type Accessor, Show } from "solid-js";

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
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    type ChainSwap,
    type ReverseSwap,
    getFinalAssetReceive,
} from "../utils/swapCreator";

const claimAssset = async (
    useRif: boolean,
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

    if (useRif) {
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
    signer: Accessor<Signer>,
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
    const amountOutMin = BigInt(Math.floor(Number(quote.quote) * 0.99));

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

    const claim = await router[
        "claimERC20Execute((bytes32,uint256,address,address,uint256,uint8,bytes32,bytes32),(address,uint256,bytes)[],address,uint256)"
    ](
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
    );

    return {
        hash: claim.hash,
        quoteAmount: Number(quote.quote),
    };
};

// TODO: use bignumber for amounts
const ClaimEvm = (props: {
    amount: number;
    swapId: string;
    useRif: boolean;
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
        <ContractTransaction
            asset={props.assetReceive}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const currentSwap = await getSwap(props.swapId);

                let transactionHash: string;
                if (props.hops !== undefined && props.hops.length > 0) {
                    const result = await claimHops(
                        props.hops,
                        props.assetReceive,
                        props.preimage,
                        props.amount,
                        props.refundAddress,
                        props.timeoutBlockHeight,
                        signer,
                        getErc20Swap(props.assetReceive),
                    );
                    transactionHash = result.hash;
                    currentSwap.dexQuoteAmount = result.quoteAmount;
                } else {
                    transactionHash = await claimAssset(
                        props.useRif,
                        props.assetReceive,
                        props.preimage,
                        props.amount,
                        props.refundAddress,
                        props.timeoutBlockHeight,
                        signer,
                        getEtherSwap(props.assetReceive),
                        getErc20Swap(props.assetReceive),
                    );
                }

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
                        useRif={chain.useRif}
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
                    useRif={reverse.useRif}
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
