import { createContext, createSignal, useContext } from "solid-js";
import type { Accessor, JSX, Setter } from "solid-js";

import type { LockupTransaction } from "../utils/boltzClient";
import type { SomeSwap } from "../utils/swapCreator";

export type PayContextType = {
    failureReason: Accessor<string>;
    setFailureReason: Setter<string>;
    swap: Accessor<SomeSwap | null>;
    setSwap: Setter<SomeSwap | null>;
    swapStatus: Accessor<string>;
    setSwapStatus: Setter<string>;
    swapStatusTransaction: Accessor<SwapStatusTransaction>;
    setSwapStatusTransaction: Setter<SwapStatusTransaction>;
    refundableUTXOs: Accessor<
        (Partial<LockupTransaction> & Pick<LockupTransaction, "hex">)[]
    >;
    setRefundableUTXOs: Setter<
        (Partial<LockupTransaction> & Pick<LockupTransaction, "hex">)[]
    >;
    shouldIgnoreBackendStatus: Accessor<boolean>;
    setShouldIgnoreBackendStatus: Setter<boolean>;
};

const PayContext = createContext<PayContextType>();

type SwapStatusTransaction = {
    hex?: string;
    id?: string;
};

const PayProvider = (props: { children: JSX.Element }) => {
    const [failureReason, setFailureReason] = createSignal<string>("");
    const [swap, setSwap] = createSignal<SomeSwap | null>(null, {
        // To allow updating properties of the swap object without replacing it completely
        equals: () => false,
    });
    const [swapStatus, setSwapStatus] = createSignal<string>("");
    const [swapStatusTransaction, setSwapStatusTransaction] =
        createSignal<SwapStatusTransaction>({});
    const [refundableUTXOs, setRefundableUTXOs] = createSignal<
        (Partial<LockupTransaction> & Pick<LockupTransaction, "hex">)[]
    >([]);
    const [shouldIgnoreBackendStatus, setShouldIgnoreBackendStatus] =
        createSignal<boolean>(false);

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
                refundableUTXOs,
                setRefundableUTXOs,
                shouldIgnoreBackendStatus,
                setShouldIgnoreBackendStatus,
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

export { usePayContext, PayProvider, SwapStatusTransaction };
