import { Show, createResource } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import ContractTransaction from "./ContractTransaction";

const InsufficientBalance = () => {
    const { t } = useGlobalContext();

    return (
        <>
            <p>{t("insufficient_balance_line")}</p>
            <button class="btn" disabled={true}>
                {t("insufficient_balance")}
            </button>
        </>
    );
};

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
    const { getEtherSwap, getSigner } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();

    const value = () => satoshiToWei(amount);

    const getSignerBalance = async () => {
        const signer = await getSigner();
        return signer.provider.getBalance(await signer.getAddress());
    };

    const [signerBalance] = createResource(getSigner, getSignerBalance);

    return (
        <Show
            when={signerBalance() > value()}
            fallback={<InsufficientBalance />}>
            <ContractTransaction
                onClick={async () => {
                    const contract = await getEtherSwap();
                    const tx = await contract.lock(
                        prefix0x(preimageHash),
                        claimAddress,
                        timeoutBlockHeight,
                        {
                            value: value(),
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
        </Show>
    );
};

export default LockupEvm;
