import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

export type PayContextType = {
    failureReason: Accessor<string>;
    setFailureReason: Setter<string>;
    swapStatus: Accessor<string>;
    setSwapStatus: Setter<string>;
    timeoutEta: Accessor<number>;
    setTimeoutEta: Setter<number>;
    timeoutBlockHeight: Accessor<number>;
    setTimeoutBlockheight: Setter<number>;
    asset: Accessor<string>;
    setAsset: Setter<string>;
};

const PayContext = createContext<PayContextType>();

const PayProvider = (props: { children: any }) => {
    const [failureReason, setFailureReason] = createSignal<string>("");
    const [swapStatus, setSwapStatus] = createSignal<string>("");

    const [timeoutEta, setTimeoutEta] = createSignal<number>(0);
    const [timeoutBlockHeight, setTimeoutBlockheight] = createSignal<number>(0);

    const [asset, setAsset] = createSignal<string>("");

    return (
        <PayContext.Provider
            value={{
                failureReason,
                setFailureReason,
                swapStatus,
                setSwapStatus,
                timeoutEta,
                setTimeoutEta,
                timeoutBlockHeight,
                setTimeoutBlockheight,
                asset,
                setAsset,
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
