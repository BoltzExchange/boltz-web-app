import { Route, Router } from "@solidjs/router";
import type { JSX } from "solid-js";

import {
    type CreateContextType,
    CreateProvider,
    useCreateContext,
} from "../src/context/Create";
import { FiatProvider } from "../src/context/Fiat";
import {
    type GlobalContextType,
    GlobalProvider,
    useGlobalContext,
} from "../src/context/Global";
import {
    type PayContextType,
    PayProvider,
    usePayContext,
} from "../src/context/Pay";
import { RescueProvider } from "../src/context/Rescue";
import { Web3SignerProvider } from "../src/context/Web3";
import { pairs as testPairs } from "./pairs";

export let signals: CreateContextType;
export let globalSignals: GlobalContextType;
export let payContext: PayContextType;

export const TestComponent = () => {
    const createSignals = useCreateContext();
    payContext = usePayContext();
    globalSignals = useGlobalContext();

    // Keep test behavior stable by providing default routable pairs.
    if (globalSignals.pairs() === undefined) {
        globalSignals.setPairs(testPairs);
    }
    if (globalSignals.regularPairs() === undefined) {
        globalSignals.setRegularPairs(testPairs);
    }

    signals = createSignals;

    return "";
};

export const contextWrapper = (props: { children: JSX.Element }) => {
    const App = () => (
        <GlobalProvider>
            <FiatProvider>
                <Web3SignerProvider noFetch={true}>
                    <CreateProvider>
                        <PayProvider>
                            <RescueProvider>
                                <Router>
                                    <Route
                                        path="/"
                                        component={() => props.children}
                                    />
                                </Router>
                            </RescueProvider>
                        </PayProvider>
                    </CreateProvider>
                </Web3SignerProvider>
            </FiatProvider>
        </GlobalProvider>
    );

    return (
        <Router root={App}>
            <Route path="/" component={() => props.children} />
        </Router>
    );
};
