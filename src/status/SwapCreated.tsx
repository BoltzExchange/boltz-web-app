import PayInvoice from "../components/PayInvoice";
import PayOnchain from "../components/PayOnchain";
import { SwapType } from "../consts/Enums";
import { usePayContext } from "../context/Pay";
import { ChainSwap, ReverseSwap } from "../utils/swapCreator";

const SwapCreated = () => {
    const { swap } = usePayContext();

    if (swap().type === SwapType.Chain) {
        const chain = swap() as ChainSwap;
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
