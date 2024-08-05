import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

import { SwapStatusTransaction } from "../utils/boltzClient";
import { SomeSwap } from "../utils/swapCreator";

export type PayContextType = {
    failureReason: Accessor;
    setFailureReason: Setter;
    swap: Accessor;
    setSwap: Setter;
    swapStatus: Accessor;
    setSwapStatus: Setter;
    swapStatusTransaction: Accessor;
    setSwapStatusTransaction: Setter;
};

const PayContext = createContext<PayContextType>();

const PayProvider = (props: { children: any }) => {
    const [failureReason, setFailureReason] = createSignal<string>("");
    const [swap, setSwap] = createSignal<SomeSwap | null>(null, {
        // To allow updating properties of the swap object without replacing it completely
        equals: () => false,
    });
    const [swapStatus, setSwapStatus] = createSignal<string>("");
    const [swapStatusTransaction, setSwapStatusTransaction] =
        createSignal<SwapStatusTransaction | null>(null);

    return (
        <PayContext.Provider
            value={{
                failureReason,
                setFailureReason,
                swap,
                setSwap,
                swapStatus,
                setSwapStatus,
                swapStatusTransaction,
                setSwapStatusTransaction,
            }}>
            {props.children}
        </PayContext.Provider>
    );
};

const usePayContext = () => {
    const context = useContext(PayContext);
    if (!context) {
        throw new Error("usePayContext: cannot find a PayContext");
    }
    return context;
};

export { usePayContext, PayProvider };
