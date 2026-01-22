import { abi as RouterAbi } from "boltz-core/out/Router.sol/Router.json";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { Router } from "boltz-core/typechain/Router";
import { Contract, Signature, type Signer } from "ethers";
import log from "loglevel";
import { type Accessor, Show } from "solid-js";

import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { relayClaimTransaction } from "../rif/Signer";
import { encodeDexQuote, quoteDexAmountIn } from "../utils/boltzClient";
import type { EncodedHop } from "../utils/pair";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import type { ChainSwap, ReverseSwap, SomeSwap } from "../utils/swapCreator";

const getCalldata = async (
    routerAddress: string,
    hop: EncodedHop,
    amount: number,
) => {
    const bestQuote = (
        await quoteDexAmountIn(
            RBTC,
            hop.dexDetails.tokenIn,
            hop.dexDetails.tokenOut,
            satoshiToWei(amount),
        )
    )[0];

    const data = await encodeDexQuote(
        RBTC,
        routerAddress,
        satoshiToWei(amount),
        // TODO: slippage tolerance
        BigInt(bestQuote.quote),
        bestQuote.data,
    );

    return { data: data.calls, minAmountOut: BigInt(bestQuote.quote) };
};

const constructClaimEvmTransaction = async (
    signer: Accessor<Signer>,
    getSwap: typeof useGlobalContext.prototype.getSwap,
    setSwap: typeof usePayContext.prototype.setSwap,
    setSwapStorage: typeof useGlobalContext.prototype.setSwapStorage,
    etherSwap: EtherSwap,
    swapId: string,
    useRif: boolean,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    hops?: EncodedHop[],
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
        if (hops === undefined || hops.length === 0) {
            transactionHash = (
                await etherSwap["claim(bytes32,uint256,address,uint256)"](
                    prefix0x(preimage),
                    satoshiToWei(amount),
                    refundAddress,
                    timeoutBlockHeight,
                )
            ).hash;
        } else {
            log.debug("Claiming via router contract");
            const hop = hops[0];

            const router = new Contract(
                config.assets[hop.from].contracts.router,
                RouterAbi,
                signer(),
            ) as unknown as Router;

            const calldataPromise = getCalldata(
                await router.getAddress(),
                hop,
                amount,
            );

            const claimSignature = Signature.from(
                await signer().signTypedData(
                    {
                        name: "EtherSwap",
                        version: "5",
                        verifyingContract: await etherSwap.getAddress(),
                        chainId: (await signer().provider.getNetwork()).chainId,
                    },
                    {
                        Claim: [
                            { name: "preimage", type: "bytes32" },
                            { name: "amount", type: "uint256" },
                            { name: "refundAddress", type: "address" },
                            { name: "timelock", type: "uint256" },
                            { name: "destination", type: "address" },
                        ],
                    },
                    {
                        preimage: prefix0x(preimage),
                        amount: satoshiToWei(amount),
                        refundAddress: refundAddress,
                        timelock: timeoutBlockHeight,
                        destination: await router.getAddress(),
                    },
                ),
            );

            const calldata = await calldataPromise;
            const claim = await router[
                "claimExecute((bytes32,uint256,address,uint256,uint8,bytes32,bytes32),(address,uint256,bytes)[],address,uint256)"
            ](
                {
                    preimage: prefix0x(preimage),
                    amount: satoshiToWei(amount),
                    refundAddress: refundAddress,
                    timelock: timeoutBlockHeight,
                    v: claimSignature.v,
                    r: claimSignature.r,
                    s: claimSignature.s,
                },
                calldata.data.map((call) => ({
                    target: call.to,
                    value: call.value,
                    callData: prefix0x(call.data),
                })),
                hop.dexDetails.tokenOut.toLowerCase(),
                calldata.minAmountOut,
            );
            transactionHash = claim.hash;
        }
    }

    const currentSwap = await getSwap(swapId);
    currentSwap.claimTx = transactionHash;
    setSwap(currentSwap);
    await setSwapStorage(currentSwap);
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
    hops?: EncodedHop[];
}) => {
    const { getEtherSwap, signer } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    return (
        <ContractTransaction
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                await constructClaimEvmTransaction(
                    signer,
                    getSwap,
                    setSwap,
                    setSwapStorage,
                    getEtherSwap(),
                    props.swapId,
                    props.useRif,
                    props.preimage,
                    props.amount,
                    props.refundAddress,
                    props.timeoutBlockHeight,
                    props.hops,
                );
            }}
            address={{
                address: props.signerAddress,
                derivationPath: props.derivationPath,
            }}
            buttonText={t("continue")}
            promptText={t("transaction_prompt_receive", {
                button: t("continue"),
                asset: props.assetReceive,
            })}
            waitingText={t("tx_ready_to_claim")}
        />
    );
};

const TransactionConfirmed = () => {
    const { t } = useGlobalContext();
    const { swap } = usePayContext();

    const chain = swap() as ChainSwap & Pick<SomeSwap, "hops">;
    const reverse = swap() as ReverseSwap & Pick<SomeSwap, "hops">;

    return (
        <Show
            when={swap().assetReceive === RBTC}
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
                />
            </Show>
        </Show>
    );
};

export default TransactionConfirmed;
