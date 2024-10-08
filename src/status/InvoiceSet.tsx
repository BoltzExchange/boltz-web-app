import LockupEvm from "../components/LockupEvm";
import PayOnchain from "../components/PayOnchain";
import { RBTC } from "../consts/Assets";
import { usePayContext } from "../context/Pay";
import { decodeInvoice } from "../utils/invoice";
import { SubmarineSwap, getRelevantAssetForSwap } from "../utils/swapCreator";

const InvoiceSet = () => {
    const { swap } = usePayContext();
    const submarine = swap() as SubmarineSwap;

    if (submarine.assetSend === RBTC) {
        return (
            <LockupEvm
                swapId={submarine.id}
                signerAddress={submarine.signer}
                amount={submarine.expectedAmount}
                claimAddress={submarine.claimAddress}
                preimageHash={decodeInvoice(submarine.invoice).preimageHash}
                timeoutBlockHeight={submarine.timeoutBlockHeight}
            />
        );
    }

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
