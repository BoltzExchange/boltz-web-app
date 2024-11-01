import { Show } from "solid-js";

import LockupEvm from "../components/LockupEvm";
import PayOnchain from "../components/PayOnchain";
import { RBTC } from "../consts/Assets";
import { usePayContext } from "../context/Pay";
import { decodeInvoice } from "../utils/invoice";
import { SubmarineSwap, getRelevantAssetForSwap } from "../utils/swapCreator";

const InvoiceSet = () => {
    const { swap } = usePayContext();
    const submarine = swap() as SubmarineSwap;

    return (
        <Show
            when={submarine.assetSend !== RBTC}
            fallback={
                <LockupEvm
                    swapId={submarine.id}
                    signerAddress={submarine.signer}
                    amount={submarine.expectedAmount}
                    claimAddress={submarine.claimAddress}
                    preimageHash={decodeInvoice(submarine.invoice).preimageHash}
                    timeoutBlockHeight={submarine.timeoutBlockHeight}
                />
            }>
            <PayOnchain
                asset={getRelevantAssetForSwap(submarine)}
                expectedAmount={submarine.expectedAmount}
                address={submarine.address}
                bip21={submarine.bip21}
            />
        </Show>
    );
};

export default InvoiceSet;
