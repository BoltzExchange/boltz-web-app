import ContractTransaction from "../components/ContractTransaction";
import PayOnchain from "../components/PayOnchain";
import { RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { decodeInvoice } from "../utils/invoice";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import { SubmarineSwap, getRelevantAssetForSwap } from "../utils/swapCreator";

const InvoiceSet = () => {
    const { swap } = usePayContext();
    // const { assetReceive } = useCreateContext();
    // const { t, getSwap, setSwapStorage } = useGlobalContext();

    // if (assetReceive() === RBTC) {
    //     const { getEtherSwap } = useWeb3Signer();

    //     return (
    //         <ContractTransaction
    //             onClick={async () => {
    //                 const contract = await getEtherSwap();

    //                 const tx = await contract.lock(
    //                     prefix0x(decodeInvoice(swap().invoice).preimageHash),
    //                     swap().claimAddress,
    //                     swap().timeoutBlockHeight,
    //                     {
    //                         value: satoshiToWei(swap().expectedAmount),
    //                     },
    //                 );

    //                 const currentSwap = await getSwap(swap().id);
    //                 currentSwap.lockupTx = tx.hash;
    //                 await setSwapStorage(currentSwap);
    //             }}
    //             buttonText={t("send")}
    //             promptText={t("transaction_prompt", { button: t("send") })}
    //             waitingText={t("tx_in_mempool_subline")}
    //             showHr={false}
    //         />
    //     );
    // }

    const submarine = swap() as SubmarineSwap;

    return (
        <PayOnchain
            asset={getRelevantAssetForSwap(submarine)}
            expectedAmount={submarine.expectedAmount}
            address={submarine.address}
            bip21={submarine.bip21}
        />
    );
};

export default InvoiceSet;
