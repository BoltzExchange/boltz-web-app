import PayOnchain from "../components/PayOnchain";
import { usePayContext } from "../context/Pay";
import { SubmarineSwap, getRelevantAssetForSwap } from "../utils/swapCreator";

const InvoiceSet = () => {
    const { swap } = usePayContext();

    // TODO
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
