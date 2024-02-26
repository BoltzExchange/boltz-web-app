/* @refresh reload */
import "@fontsource/noto-sans";
import "@fontsource/noto-sans/800.css";
import { Route, Router } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import log from "loglevel";
import { onMount } from "solid-js";
import { Show, render } from "solid-js/web";

import Footer from "./components/Footer";
import Nav from "./components/Nav";
import Notification from "./components/Notification";
import { config, updateConfig } from "./config";
import { AppProvider } from "./context/App";
import { ClientProvider } from "./context/Client";
import { CreateProvider } from "./context/Create";
import { GlobalProvider, useGlobalContext } from "./context/Global";
import { PayProvider } from "./context/Pay";
import { Web3SignerProvider } from "./context/Web3";
import Create from "./pages/Create";
import Error from "./pages/Error";
import Hero from "./pages/Hero";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import Pay from "./pages/Pay";
import Refund from "./pages/Refund";
import RefundStep from "./pages/RefundStep";
import "./style/index.scss";
import { isBoltzClient } from "./utils/helper";
import { loadLazyModules } from "./utils/lazy";
import "./utils/patches";

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("./service-worker.js", { scope: "./" })
        .then((reg) => {
            log.info(`Registration succeeded. Scope is ${reg.scope}`);
        });
}

const isEmbedded = () => {
    return useGlobalContext().embedded();
};

const queryClient = new QueryClient();

const init = async () => {
    const config = window["config"];
    if (config) {
        updateConfig(config);
        delete window["config"];
        await loadLazyModules();
    }
};
window.addEventListener("config", init);

const App = (props: any) => {
    onMount(init);
    document.body.classList.remove("loading");
    const Provider = isBoltzClient() ? ClientProvider : AppProvider;
    return (
        <QueryClientProvider client={queryClient}>
            <GlobalProvider>
                <Web3SignerProvider>
                    <PayProvider>
                        <CreateProvider>
                            <Provider>
                                <Show when={!isEmbedded()}>
                                    <Nav network={config().network} />
                                </Show>
                                {props.children}
                                <Notification />
                                <Show when={!isEmbedded()}>
                                    <Footer />
                                </Show>
                            </Provider>
                        </CreateProvider>
                    </PayProvider>
                </Web3SignerProvider>
            </GlobalProvider>
        </QueryClientProvider>
    );
};

const cleanup = render(
    () => (
        <Router root={App}>
            wtf?
            <Route path="/" component={Hero} />
            <Route path="/swap" component={Create} />
            {/* Compatibility with link in Breez:
                                https://github.com/breez/breezmobile/blob/a1b0ffff902dfa2210af8fdb047b715535ff11e9/src/json/vendors.json#L30 */}
            <Route path="/swapbox" component={Create} />
            <Route path="/swap/:id" component={Pay} />
            <Route path="/swap/refund/:id" component={RefundStep} />
            <Route path="/error" component={Error} />
            <Show when={!isBoltzClient()}>
                <Route path="/refund" component={Refund} />
            </Show>
            <Route path="/history" component={History} />
            <Route path="*404" component={NotFound} />
        </Router>
    ),
    document.getElementById("root"),
);

if (import.meta.hot) {
    console.log("Hot reload");
    import.meta.hot.dispose(cleanup);
}
