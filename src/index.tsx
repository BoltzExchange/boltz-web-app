/* @refresh reload */
import "@fontsource/noto-sans";
import "@fontsource/noto-sans/800.css";
import { Navigate, Route, Router } from "@solidjs/router";
import log from "loglevel";
import { Show, render } from "solid-js/web";

import Footer from "./components/Footer";
import Nav from "./components/Nav";
import Notification from "./components/Notification";
import { SwapChecker } from "./components/SwapChecker";
import { loglevel, network } from "./config";
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
import "./utils/patches";

log.setLevel(loglevel);

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("./service-worker.js", { scope: "./" })
        .then((reg) => {
            log.info(`Registration succeeded. Scope is ${reg.scope}`);
        });
}

document.body.classList.remove("loading");

const isEmbedded = () => {
    return useGlobalContext().embedded();
};

const cleanup = render(
    () => (
        <Router>
            <GlobalProvider>
                <Web3SignerProvider>
                    <CreateProvider>
                        <PayProvider>
                            <SwapChecker />
                            <Show when={!isEmbedded()}>
                                <Nav network={network} />
                            </Show>
                            <Routes>
                                <Route
                                    path="*"
                                    element={<Navigate href={"/404"} />}
                                />
                                <Route path="/404" component={NotFound} />
                                <Route path="/" component={Hero} />
                                <Route path="/swap" component={Create} />
                                {/* Compatibility with link in Breez:
                                    https://github.com/breez/breezmobile/blob/a1b0ffff902dfa2210af8fdb047b715535ff11e9/src/json/vendors.json#L30 */}
                                <Route path="/swapbox" component={Create} />
                                <Route path="/swap/:id" component={Pay} />
                                <Route
                                    path="/swap/refund/:id"
                                    component={RefundStep}
                                />
                                <Route path="/error" component={Error} />
                                <Route path="/refund" component={Refund} />
                                <Route path="/history" component={History} />
                            </Routes>
                            <Notification />
                            <Show when={!isEmbedded()}>
                                <Footer />
                            </Show>
                        </PayProvider>
                    </CreateProvider>
                </Web3SignerProvider>
            </GlobalProvider>
        </Router>
    ),
    document.getElementById("root"),
);

if (import.meta.hot) {
    console.log("Hot reload");
    import.meta.hot.dispose(cleanup);
}
