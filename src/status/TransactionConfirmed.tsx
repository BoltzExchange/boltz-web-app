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
const ClaimRsk = ({
    useRif,
    swapId,
    amount,
    preimage,
    refundAddress,
    timeoutBlockHeight,
}: {
    amount: number;
    swapId: string;
    useRif: boolean;
    preimage: string;
    refundAddress: string;
    timeoutBlockHeight: number;
}) => {
    const { getEtherSwap, getSigner } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    return (
        <ContractTransaction
            onClick={async () => {
                const contract = await getEtherSwap();
                const signer = await getSigner();

                let transactionHash: string;

                if (useRif) {
                    transactionHash = await relayClaimTransaction(
                        signer,
                        contract,
                        preimage,
                        amount,
                        refundAddress,
                        timeoutBlockHeight,
                    );
                } else {
                    transactionHash = (
                        await contract[
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
            buttonText={t("claim")}
            promptText={t("transaction_prompt", { button: t("claim") })}
            waitingText={t("tx_ready_to_claim")}
            showHr={true}
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
                <ClaimRsk
                    swapId={chain.id}
                    useRif={chain.useRif}
                    preimage={chain.preimage}
                    amount={chain.claimDetails.amount}
                    refundAddress={chain.claimDetails.refundAddress}
                    timeoutBlockHeight={chain.claimDetails.timeoutBlockHeight}
                />
            );
        }

        const reverse = swap() as ReverseSwap;

        return (
            <ClaimRsk
                swapId={reverse.id}
                useRif={reverse.useRif}
                preimage={reverse.preimage}
                amount={reverse.onchainAmount}
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
