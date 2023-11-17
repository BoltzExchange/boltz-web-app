import t from "../i18n";
import { RBTC } from "../consts";
import { useWeb3Signer } from "../context/Web3";
import { asset, setSwaps, swap, swaps } from "../signals";
import LoadingSpinner from "../components/LoadingSpinner";
import { prefix0x, satoshiToWei } from "../utils/ethereum";
import EthereumTransaction from "../components/EthereumTransaction.jsx";


const TransactionConfirmed = () => {
    if (asset() === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <EthereumTransaction
                onClick={async () => {
                    const contract = await getEtherSwap();

                    const tx = await contract.claim(
                        prefix0x(swap().preimage),
                        satoshiToWei(swap().onchainAmount),
                        swap().refundAddress,
                        swap().timeoutBlockHeight,
                    );

                    const swapsTmp = swaps();
                    const currentSwap = swapsTmp.find(
                        (s) => swap().id === s.id,
                    );
                    currentSwap.claimTx = tx.hash;
                    setSwaps(swapsTmp);
                }}
                buttonText={t("claim")}
                promptText={t("claim_prompt")}
                waitingText={t("tx_ready_to_claim")}
                showHr={true}
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
