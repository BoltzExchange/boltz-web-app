import { Route, Router } from "@solidjs/router";

import type { CreateContextType } from "../src/context/Create";
import { CreateProvider, useCreateContext } from "../src/context/Create";
import type { GlobalContextType } from "../src/context/Global";
import { GlobalProvider, useGlobalContext } from "../src/context/Global";
import type { PayContextType } from "../src/context/Pay";
import { PayProvider, usePayContext } from "../src/context/Pay";
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

export const contextWrapper = (props: { children: Element }) => {
    const App = () => (
        <GlobalProvider>
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
        </GlobalProvider>
    );

    return (
        <Router root={App}>
            <Route path="/" component={() => props.children} />
        </Router>
    );
};
