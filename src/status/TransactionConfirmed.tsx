import { Show } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import { ChainSwap, ReverseSwap } from "../utils/swapCreator";

const ClaimRsk = ({
    swapId,
    preimage,
    amount,
    refundAddress,
    timeoutBlockHeight,
}: {
    swapId: string;
    preimage: string;
    amount: number;
    refundAddress: string;
    timeoutBlockHeight: number;
}) => {
    const { getEtherSwap } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

    return (
        <ContractTransaction
            onClick={async () => {
                const contract = await getEtherSwap();

                const tx = await contract[
                    "claim(bytes32,uint256,address,uint256)"
                ](
                    prefix0x(preimage),
                    satoshiToWei(amount),
                    refundAddress,
                    timeoutBlockHeight,
                );
                const currentSwap = await getSwap(swapId);
                currentSwap.claimTx = tx.hash;
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
    const { swapStatusTransaction, swap } = usePayContext();

    if (swap().assetReceive === RBTC) {
        if (swap().type === SwapType.Chain) {
            const chain = swap() as ChainSwap;

            return (
                <ClaimRsk
                    swapId={chain.id}
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
                timeoutBlockHeight={reverse.timeoutBlockHeight}
                amount={reverse.onchainAmount}
                preimage={reverse.preimage}
                refundAddress={reverse.refundAddress}
            />
        );
    }

    return (
        <div>
            <h2>{t("tx_confirmed")}</h2>
            <p>{t("tx_ready_to_claim")}</p>
            <LoadingSpinner />
            <Show when={swapStatusTransaction() !== null}>
                <BlockExplorer
                    asset={swap().assetSend}
                    txId={swapStatusTransaction().id}
                    typeLabel="lockup_tx"
                />
            </Show>
        </div>
    );
};

export default TransactionConfirmed;
