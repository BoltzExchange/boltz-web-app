import t from "../i18n";
import { RBTC } from "../consts";
import { asset, swap } from "../signals";
import { useWeb3Signer } from "../context/Web3";
import LoadingSpinner from "../components/LoadingSpinner";
import { prefix0x, satoshiToWei } from "../utils/ethereum";

const TransactionConfirmed = () => {
    if (asset() === RBTC) {
        const { getEtherSwap } = useWeb3Signer();

        return (
            <button
                class="btn"
                onClick={async () => {
                    const contract = await getEtherSwap();

                    await contract.claim(
                        prefix0x(swap().preimage),
                        satoshiToWei(swap().onchainAmount),
                        swap().refundAddress,
                        swap().timeoutBlockHeight,
                    );
                }}>
                Claim
            </button>
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
