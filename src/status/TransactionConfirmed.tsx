import { Show, onMount } from "solid-js";

import AddressInput from "../components/AddressInput";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { relayClaimTransaction } from "../rif/Signer";
import { claim } from "../utils/claim";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import type { ChainSwap, ReverseSwap } from "../utils/swapCreator";

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
}) => {
    const { getEtherSwap, signer } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    return (
        <ContractTransaction
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                let transactionHash: string;

                if (props.useRif) {
                    transactionHash = await relayClaimTransaction(
                        signer(),
                        getEtherSwap(),
                        props.preimage,
                        props.amount,
                        props.refundAddress,
                        props.timeoutBlockHeight,
                    );
                } else {
                    transactionHash = (
                        await getEtherSwap()[
                            "claim(bytes32,uint256,address,uint256)"
                        ](
                            prefix0x(props.preimage),
                            satoshiToWei(props.amount),
                            props.refundAddress,
                            props.timeoutBlockHeight,
                        )
                    ).hash;
                }

                const currentSwap = await getSwap(props.swapId);
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
                asset: props.assetReceive,
            })}
            waitingText={t("tx_ready_to_claim")}
        />
    );
};

const TransactionConfirmed = () => {
    const { t, deriveKey, notify, getSwap, setSwapStorage, externalBroadcast } =
        useGlobalContext();
    const { onchainAddress, setOnchainAddress } = useCreateContext();
    const { swap, setSwap, claimFailed, swapStatusTransaction } =
        usePayContext();

    const chain = swap() as ChainSwap;
    const reverse = swap() as ReverseSwap;

    const handleClaim = async () => {
        setSwap({ ...swap(), claimAddress: onchainAddress() });

        const res = await claim(
            deriveKey,
            swap() as ChainSwap,
            swapStatusTransaction() as { hex: string },
            true,
            externalBroadcast(),
        );
        const claimedSwap = await getSwap(res.id);
        claimedSwap.claimTx = res.claimTx;
        await setSwapStorage(claimedSwap);

        if (claimedSwap.id === swap().id) {
            setSwap(claimedSwap);
        }
        notify("success", t("swap_completed", { id: res.id }), true, true);
    };

    onMount(() => {
        setOnchainAddress("");
    });

    return (
        <Show
            when={swap().assetReceive === RBTC}
            fallback={
                <div>
                    <Show
                        when={!claimFailed()}
                        fallback={
                            <>
                                <p>{t("claim_address_prompt")}</p>
                                <AddressInput />
                                <button class="btn" onClick={handleClaim}>
                                    {t("claim")}
                                </button>
                            </>
                        }>
                        <h2>{t("tx_confirmed")}</h2>
                        <p>{t("tx_ready_to_claim")}</p>
                        <LoadingSpinner />
                    </Show>
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
                />
            </Show>
        </Show>
    );
};

export default TransactionConfirmed;
