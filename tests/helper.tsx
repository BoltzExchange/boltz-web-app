import { Route, Router } from "@solidjs/router";

import { CreateProvider, useCreateContext } from "../src/context/Create";
import { GlobalProvider, useGlobalContext } from "../src/context/Global";
import { PayProvider } from "../src/context/Pay";
import { Web3SignerProvider } from "../src/context/Web3";

export let signals: any;
export let globalSignals: any;

export const TestComponent = () => {
    signals = useCreateContext();
    globalSignals = useGlobalContext();
    return "";
};

export const contextWrapper = (props: any) => {
    return (
        <GlobalProvider>
            <Web3SignerProvider noFetch={true}>
                <CreateProvider>
                    <PayProvider>
                        <Router>
                            <Route path="/" component={() => props.children} />
                        </Router>
                    </PayProvider>
                </CreateProvider>
            </Web3SignerProvider>
        </GlobalProvider>
    );
};
