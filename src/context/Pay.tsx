import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

import { SomeSwap } from "../utils/swapCreator";

export type PayContextType = {
    failureReason: Accessor<string>;
    setFailureReason: Setter<string>;
    swap: Accessor<SomeSwap | null>;
    setSwap: Setter<SomeSwap | null>;
    swapStatus: Accessor<string>;
    setSwapStatus: Setter<string>;
    swapStatusTransaction: Accessor<SwapStatusTransaction>;
    setSwapStatusTransaction: Setter<SwapStatusTransaction>;
};

const PayContext = createContext<PayContextType>();

type SwapStatusTransaction = {
    hex?: string;
    id?: string;
};

const PayProvider = (props: { children: any }) => {
    const [failureReason, setFailureReason] = createSignal<string>("");
    const [swap, setSwap] = createSignal<SomeSwap | null>(null, {
        // To allow updating properties of the swap object without replacing it completely
        equals: () => false,
    });
    const [swapStatus, setSwapStatus] = createSignal<string>("");
    const [swapStatusTransaction, setSwapStatusTransaction] =
        createSignal<SwapStatusTransaction>({});

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
