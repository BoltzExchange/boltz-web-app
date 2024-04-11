import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";

const TransactionConfirmed = () => {
    const { t } = useGlobalContext();

    // TODO
    /*
    if (assetReceive() === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <ContractTransaction
                onClick={async () => {
                    const contract = await getEtherSwap();

                    const tx = await contract[
                        "claim(bytes32,uint256,address,uint256)"
                    ](
                        prefix0x(swap().preimage),
                        satoshiToWei(swap().onchainAmount),
                        swap().refundAddress,
                        swap().timeoutBlockHeight,
                    );
                    const currentSwap = await getSwap(swap().id);
                    currentSwap.claimTx = tx.hash;
                    await setSwapStorage(currentSwap);
                }}
                buttonText={t("claim")}
                promptText={t("transaction_prompt", { button: t("claim") })}
                waitingText={t("tx_ready_to_claim")}
                showHr={true}
            />
        );
    }

     */

    return (
        <div>
            <h2>{t("tx_confirmed")}</h2>
            <p>{t("tx_ready_to_claim")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionConfirmed;
