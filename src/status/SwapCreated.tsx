import { crypto } from "bitcoinjs-lib";

import LockupEvm from "../components/LockupEvm";
import PayInvoice from "../components/PayInvoice";
import PayOnchain from "../components/PayOnchain";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { usePayContext } from "../context/Pay";
import { ChainSwap, ReverseSwap } from "../utils/swapCreator";

const SwapCreated = () => {
    const { swap } = usePayContext();

    if (swap().type === SwapType.Chain) {
        const chain = swap() as ChainSwap;

        if (chain.assetSend === RBTC) {
            return (
                <LockupEvm
                    swapId={chain.id}
                    signerAddress={chain.signer}
                    amount={chain.lockupDetails.amount}
                    claimAddress={chain.lockupDetails.claimAddress}
                    timeoutBlockHeight={chain.lockupDetails.timeoutBlockHeight}
                    preimageHash={crypto
                        .sha256(Buffer.from(chain.preimage, "hex"))
                        .toString("hex")}
                />
            );
        }

        return (
            <PayOnchain
                asset={chain.assetSend}
                expectedAmount={chain.lockupDetails.amount}
                address={chain.lockupDetails.lockupAddress}
                bip21={chain.lockupDetails.bip21}
            />
        );
    }

    const reverse = swap() as ReverseSwap;
    return (
        <PayInvoice sendAmount={reverse.sendAmount} invoice={reverse.invoice} />
    );
};

export default SwapCreated;
