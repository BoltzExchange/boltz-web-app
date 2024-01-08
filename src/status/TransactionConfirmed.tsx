import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import t from "../i18n";
import { prefix0x, satoshiToWei } from "../utils/rootstock";

const TransactionConfirmed = () => {
    const { swap } = usePayContext();
    const { asset } = useCreateContext();
    const { swaps, setSwaps } = useGlobalContext();
    if (asset() === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <ContractTransaction
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
                        (s: any) => swap().id === s.id,
                    );
                    currentSwap.claimTx = tx.hash;
                    setSwaps(swapsTmp);
                }}
                buttonText={t("claim")}
                promptText={t("transaction_prompt", { button: t("claim") })}
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
