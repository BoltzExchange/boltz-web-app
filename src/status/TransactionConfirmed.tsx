import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useSwapContext } from "../context/Swap";
import { useWeb3Signer } from "../context/Web3";
import { isBoltzClient } from "../utils/helper";
import { prefix0x, satoshiToWei } from "../utils/rootstock";

const ClaimRootstock = () => {
    const { t } = useGlobalContext();
    const { swap, swaps, setSwaps } = useSwapContext();
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
};

const TransactionConfirmed = () => {
    const { asset } = usePayContext();
    const { t } = useGlobalContext();
    if (asset() === RBTC && !isBoltzClient) {
        return <ClaimRootstock />;
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
