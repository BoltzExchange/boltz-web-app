import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

const PayContext = createContext<{
    failureReason: Accessor<string>;
    setFailureReason: Setter<string>;
    swap: Accessor<any>;
    setSwap: Setter<any>;
    swapStatus: Accessor<string>;
    setSwapStatus: Setter<string>;
    swapStatusTransaction: Accessor<SwapStatusTransaction>;
    setSwapStatusTransaction: Setter<SwapStatusTransaction>;
    timeoutEta: Accessor<number>;
    setTimeoutEta: Setter<number>;
    timeoutBlockHeight: Accessor<number>;
    setTimeoutBlockheight: Setter<number>;
}>();

type SwapStatusTransaction = {
    hex?: string;
    id?: string;
};

const PayProvider = (props: { children: any }) => {
    const [failureReason, setFailureReason] = createSignal<string>("");
    const [swap, setSwap] = createSignal(null, {
        // To allow updating properties of the swap object without replacing it completely
        equals: () => false,
    });
    const [swapStatus, setSwapStatus] = createSignal<string>("");
    const [swapStatusTransaction, setSwapStatusTransaction] =
        createSignal<SwapStatusTransaction>({});

    const [timeoutEta, setTimeoutEta] = createSignal<number>(0);
    const [timeoutBlockHeight, setTimeoutBlockheight] = createSignal<number>(0);

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
                timeoutEta,
                setTimeoutEta,
                timeoutBlockHeight,
                setTimeoutBlockheight,
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
