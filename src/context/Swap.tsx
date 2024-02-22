import { makePersisted } from "@solid-primitives/storage";
import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

import { isBoltzClient } from "../utils/helper";
import { swapStatusFinal } from "../utils/swapStatus";

export type SwapContextType = {
    swap: Accessor<any>;
    setSwap: Setter<any>;
    swapStatusTransaction: Accessor<SwapStatusTransaction>;
    setSwapStatusTransaction: Setter<SwapStatusTransaction>;

    swaps: Accessor<any>;
    setSwaps: Setter<any>;

    updateSwapStatus: (id: string, newStatus: string) => boolean;
};

const SwapContext = createContext<SwapContextType>();

type SwapStatusTransaction = {
    hex?: string;
    id?: string;
};

const SwapProvider = (props: { children: any }) => {
    const [swap, setSwap] = createSignal(null, {
        // To allow updating properties of the swap object without replacing it completely
        equals: () => false,
    });
    const [swapStatusTransaction, setSwapStatusTransaction] =
        createSignal<SwapStatusTransaction>({});

    const updateSwapStatus = (id: string, newStatus: string) => {
        if (swapStatusFinal.includes(newStatus)) {
            const swapsTmp = swaps();
            const swap = swapsTmp.find((swap) => swap.id === id);

            if (swap.status !== newStatus) {
                swap.status = newStatus;
                setSwaps(swapsTmp);
                return true;
            }
        }
        return false;
    };

    const [swaps, setSwaps] = makePersisted(
        createSignal([], {
            // Because arrays are the same object when changed,
            // we have to override the equality checker
            equals: () => false,
        }),
        {
            name: "swaps",
        },
    );

    return (
        <SwapContext.Provider
            value={{
                swaps,
                setSwaps,
                swap,
                setSwap,
                swapStatusTransaction,
                setSwapStatusTransaction,
                updateSwapStatus,
            }}>
            {props.children}
        </SwapContext.Provider>
    );
};

const useSwapContext = () => {
    const context = useContext(SwapContext);
    if (!context || isBoltzClient) {
        throw new Error("useSwapContext: cannot find a SwapContext");
    }
    return context;
};

export { useSwapContext, SwapProvider };
