import { Route, Router } from "@solidjs/router";

import { CreateProvider } from "../src/context/Create";
import { GlobalProvider } from "../src/context/Global";
import { Web3SignerProvider } from "../src/context/Web3";

export const contextWrapper = (props: any) => {
    return (
        <GlobalProvider>
            <Web3SignerProvider noFetch={true}>
                <CreateProvider>
                    <Router>
                        <Route path="/" component={() => props.children} />
                    </Router>
                </CreateProvider>
            </Web3SignerProvider>
        </GlobalProvider>
    );
};
