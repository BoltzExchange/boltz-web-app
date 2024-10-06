import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { relayClaimTransaction } from "../rif/Signer";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import { ChainSwap, ReverseSwap } from "../utils/swapCreator";

// TODO: use bignumber for amounts
const ClaimEvm = ({
    useRif,
    swapId,
    amount,
    preimage,
    signerAddress,
    refundAddress,
    timeoutBlockHeight,
}: {
    amount: number;
    swapId: string;
    useRif: boolean;
    preimage: string;
    signerAddress: string;
    refundAddress: string;
    timeoutBlockHeight: number;
}) => {
    const { getEtherSwap, signer } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    return (
        <ContractTransaction
            onClick={async () => {
                let transactionHash: string;

                if (useRif) {
                    transactionHash = await relayClaimTransaction(
                        signer(),
                        signer().rdns,
                        getEtherSwap(),
                        preimage,
                        amount,
                        refundAddress,
                        timeoutBlockHeight,
                    );
                } else {
                    transactionHash = (
                        await getEtherSwap()[
                            "claim(bytes32,uint256,address,uint256)"
                        ](
                            prefix0x(preimage),
                            satoshiToWei(amount),
                            refundAddress,
                            timeoutBlockHeight,
                        )
                    ).hash;
                }

                const currentSwap = await getSwap(swapId);
                currentSwap.claimTx = transactionHash;
                setSwap(currentSwap);
                await setSwapStorage(currentSwap);
            }}
            address={signerAddress}
            buttonText={t("continue")}
            promptText={t("transaction_prompt", { button: t("continue") })}
            waitingText={t("tx_ready_to_claim")}
        />
    );
};

const TransactionConfirmed = () => {
    const { t } = useGlobalContext();
    const { swap } = usePayContext();

    if (swap().assetReceive === RBTC) {
        if (swap().type === SwapType.Chain) {
            const chain = swap() as ChainSwap;

            return (
                <ClaimEvm
                    swapId={chain.id}
                    useRif={chain.useRif}
                    preimage={chain.preimage}
                    signerAddress={chain.signer}
                    amount={chain.claimDetails.amount}
                    refundAddress={chain.claimDetails.refundAddress}
                    timeoutBlockHeight={chain.claimDetails.timeoutBlockHeight}
                />
            );
        }

        const reverse = swap() as ReverseSwap;

        return (
            <ClaimEvm
                swapId={reverse.id}
                useRif={reverse.useRif}
                preimage={reverse.preimage}
                amount={reverse.onchainAmount}
                signerAddress={reverse.signer}
                refundAddress={reverse.refundAddress}
                timeoutBlockHeight={reverse.timeoutBlockHeight}
            />
        );
    }

    return (
        <div>
            <h2>{t("tx_confirmed")}</h2>
            <p>{t("tx_ready_to_claim")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionConfirmed;
