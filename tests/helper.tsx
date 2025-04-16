import { Route, Router } from "@solidjs/router";

import type { CreateContextType } from "../src/context/Create";
import { CreateProvider, useCreateContext } from "../src/context/Create";
import type { GlobalContextType } from "../src/context/Global";
import { GlobalProvider, useGlobalContext } from "../src/context/Global";
import type { PayContextType } from "../src/context/Pay";
import { PayProvider, usePayContext } from "../src/context/Pay";
import { RescueProvider } from "../src/context/Rescue";
import { Web3SignerProvider } from "../src/context/Web3";

export let signals: CreateContextType;
export let globalSignals: GlobalContextType;
export let payContext: PayContextType;

export const TestComponent = () => {
    signals = useCreateContext();
    payContext = usePayContext();
    globalSignals = useGlobalContext();
    return "";
};

export const contextWrapper = (props: { children: Element }) => {
    return (
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
};
