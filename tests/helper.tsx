import { Route, Router } from "@solidjs/router";
import { readFileSync } from "fs";

import { config, updateConfig } from "../src/config";
import { AppContextType, AppProvider, useAppContext } from "../src/context/App";
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
import { Web3SignerProvider } from "../src/context/Web3";
import { loadLazyModules } from "../src/utils/lazy";

export let signals: CreateContextType;
export let globalSignals: GlobalContextType;
export let payContext: PayContextType;
export let swapContext: AppContextType;
export let createContext: CreateContextType;

export const TestComponent = () => {
    signals = useCreateContext();
    payContext = usePayContext();
    globalSignals = useGlobalContext();
    swapContext = useAppContext();
    createContext = useCreateContext();
    return "";
};

export const initConfig = () => {
    const config = JSON.parse(readFileSync("public/config.json", "utf-8"));
    updateConfig(config);
};

initConfig();
export { config };

loadLazyModules();

export const contextWrapper = (props: any) => {
    const Provider = AppProvider;
    return (
        <GlobalProvider>
            <Router>
                <Route
                    path="/"
                    component={() => (
                        <Web3SignerProvider noFetch={true}>
                            <PayProvider>
                                <CreateProvider>
                                    <Provider>
                                        <PayProvider>
                                            {props.children}
                                        </PayProvider>
                                    </Provider>
                                </CreateProvider>
                            </PayProvider>
                        </Web3SignerProvider>
                    )}
                />
            </Router>
        </GlobalProvider>
    );
};
