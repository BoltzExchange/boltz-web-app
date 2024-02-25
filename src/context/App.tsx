import { makePersisted } from "@solid-primitives/storage";
import { useNavigate } from "@solidjs/router";
import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    lazy,
    useContext,
} from "solid-js";

import { RBTC } from "../consts";
import { getPairs } from "../utils/boltzApi";
import { isBoltzClient } from "../utils/helper";
import { swapStatusFinal } from "../utils/swapStatus";
import { useCreateContext } from "./Create";
import { useGlobalContext } from "./Global";
import { usePayContext } from "./Pay";
import { useWeb3Signer } from "./Web3";

export type AppContextType = {
    swap: Accessor<any>;
    setSwap: Setter<any>;
    swapStatusTransaction: Accessor<SwapStatusTransaction>;
    setSwapStatusTransaction: Setter<SwapStatusTransaction>;

    swaps: Accessor<any>;
    setSwaps: Setter<any>;

    updateSwapStatus: (id: string, newStatus: string) => boolean;
};

const AppContext = createContext<AppContextType>();

type SwapStatusTransaction = {
    hex?: string;
    id?: string;
};

const AppProvider = (props: { children: any }) => {
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

    const globalContext = useGlobalContext();
    const { setBackend } = globalContext;
    const createContext = useCreateContext();

    const { getEtherSwap } = useWeb3Signer();

    const navigate = useNavigate();

    import("../utils/lazy/create").then((create) => {
        setBackend((backend) => {
            backend.createSwap = async () => {
                const data = await create.default(
                    createContext,
                    globalContext,
                    getEtherSwap,
                );

                if (data) {
                    setSwaps(swaps().concat(data));
                    createContext.setInvoice("");
                    createContext.setInvoiceValid(false);
                    createContext.setOnchainAddress("");
                    createContext.setAddressValid(false);
                    if (
                        createContext.reverse() ||
                        createContext.asset() == RBTC
                    ) {
                        navigate("/swap/" + data.id);
                    } else {
                        navigate("/swap/refund/" + data.id);
                    }
                } else {
                    navigate("/error");
                }
            };
            return backend;
        });
    });
    setBackend({
        createSwap: async () => {
            console.log("hi");
        },
        fetchPairs: (asset) => getPairs(asset),
        SwapStatusPage: lazy(() => import("../pages/AppPay")),
        SwapHistory: lazy(() => import("../components/WebHistory")),
    });

    const value = {
        swaps,
        setSwaps,
        swap,
        setSwap,
        swapStatusTransaction,
        setSwapStatusTransaction,
        updateSwapStatus,
    };

    const payContext = usePayContext();

    import("../utils/lazy/swapchecker").then((swapchecker) => {
        swapchecker.createSwapChecker(payContext, globalContext, value);
    });

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
};

const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context || isBoltzClient()) {
        throw new Error("useSwapContext: cannot find a SwapContext");
    }
    return context;
};

export { useAppContext, AppProvider };
