import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import ContractTransaction from "./ContractTransaction";

const LockupEvm = ({
    swapId,
    amount,
    preimageHash,
    claimAddress,
    timeoutBlockHeight,
}: {
    swapId: string;
    preimageHash: string;
    claimAddress: string;
    timeoutBlockHeight: number;
    amount: number;
}) => {
    const { getEtherSwap } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();

    return (
        <ContractTransaction
            onClick={async () => {
                const contract = await getEtherSwap();
                const tx = await contract.lock(
                    prefix0x(preimageHash),
                    claimAddress,
                    timeoutBlockHeight,
                    {
                        value: satoshiToWei(amount),
                    },
                );
                const currentSwap = await getSwap(swapId);
                currentSwap.lockupTx = tx.hash;
                await setSwapStorage(currentSwap);
            }}
            buttonText={t("send")}
            promptText={t("transaction_prompt", { button: t("send") })}
            waitingText={t("tx_in_mempool_subline")}
            showHr={false}
        />
    );
};

export default LockupEvm;
