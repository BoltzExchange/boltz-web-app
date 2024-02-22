import { Route, Router } from "@solidjs/router";

import {
    CreateContextType,
    CreateProvider,
    useCreateContext,
} from "../src/context/Create";
import {
    GlobalContextType,
    GlobalProvider,
    useGlobalContext,
} from "../src/context/Global";
import { PayContextType, PayProvider, usePayContext } from "../src/context/Pay";
import {
    SwapContextType,
    SwapProvider,
    useSwapContext,
} from "../src/context/Swap";
import { Web3SignerProvider } from "../src/context/Web3";

export let signals: CreateContextType;
export let globalSignals: GlobalContextType;
export let payContext: PayContextType;
export let swapContext: SwapContextType;

export const TestComponent = () => {
    signals = useCreateContext();
    payContext = usePayContext();
    globalSignals = useGlobalContext();
    swapContext = useSwapContext();
    return "";
};

export const contextWrapper = (props: any) => {
    return (
        <Router>
            <Route
                path="/"
                component={() => (
                    <GlobalProvider>
                        <Web3SignerProvider noFetch={true}>
                            <SwapProvider>
                                <PayProvider>
                                    <CreateProvider>
                                        {props.children}
                                    </CreateProvider>
                                </PayProvider>
                            </SwapProvider>
                        </Web3SignerProvider>
                    </GlobalProvider>
                )}
            />
        </Router>
    );
};
