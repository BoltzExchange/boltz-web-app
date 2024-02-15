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
import { PayProvider } from "../src/context/Pay";
import { Web3SignerProvider } from "../src/context/Web3";

export let signals: CreateContextType;
export let globalSignals: GlobalContextType;

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
