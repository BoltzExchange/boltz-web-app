/* @refresh reload */
import "@fontsource/noto-mono";
import "@fontsource/noto-sans";
import "@fontsource/noto-sans/800.css";
import type { RouteSectionProps } from "@solidjs/router";
import { Navigate, Route, Router } from "@solidjs/router";
import log from "loglevel";
import { Show } from "solid-js";
import { render } from "solid-js/web";

import Chatwoot from "./chatwoot";
import Footer from "./components/Footer";
import Nav from "./components/Nav";
import Notification from "./components/Notification";
import { SwapChecker } from "./components/SwapChecker";
import { config } from "./config";
import { CreateProvider } from "./context/Create";
import { GlobalProvider, useGlobalContext } from "./context/Global";
import { PayProvider } from "./context/Pay";
import { RescueProvider } from "./context/Rescue";
import { Web3SignerProvider } from "./context/Web3";
import Backup from "./pages/Backup";
import { BackupMnemonic } from "./pages/BackupMnemonic";
import BackupVerify from "./pages/BackupVerify";
import BackupVerifyExisting from "./pages/BackupVerifyExisting";
import ClaimRescue from "./pages/ClaimRescue";
import Create from "./pages/Create";
import Error from "./pages/Error";
import Hero from "./pages/Hero";
import History from "./pages/History";
import MnemonicVerify from "./pages/MnemonicVerify";
import NotFound from "./pages/NotFound";
import Pay from "./pages/Pay";
import Privacy from "./pages/Privacy";
import RefundEvm from "./pages/RefundEvm";
import RefundRescue from "./pages/RefundRescue";
import Rescue from "./pages/Rescue";
import RescueExternal from "./pages/RescueExternal";
import Terms from "./pages/Terms";
import "./style/index.scss";
import { initEcc } from "./utils/ecpair";
import "./utils/patches";

if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
        .register("/service-worker.js", { scope: "/" })
        .then((reg) => {
            log.info(`Registration succeeded. Scope is ${reg.scope}`);
        });
}

const isEmbedded = () => {
    return useGlobalContext().embedded();
};

log.setLevel(config.loglevel as log.LogLevelDesc);
document.documentElement.setAttribute(
    "boltz-theme",
    config.isPro ? "pro" : "default",
);
document.body.classList.remove("loading");

const App = (props: RouteSectionProps) => {
    initEcc();
    return (
        <GlobalProvider>
            <Web3SignerProvider>
                <CreateProvider>
                    <PayProvider>
                        <RescueProvider>
                            <SwapChecker />
                            <Chatwoot />
                            <Show when={!isEmbedded()}>
                                <Nav
                                    isPro={config.isPro}
                                    network={config.network}
                                />
                            </Show>
                            {props.children}
                            <Notification />
                            <Show when={!isEmbedded()}>
                                <Footer />
                            </Show>
                        </RescueProvider>
                    </PayProvider>
                </CreateProvider>
            </Web3SignerProvider>
        </GlobalProvider>
    );
};

const redirectRefundToRescue = () => {
    const params = window.location.search;

    return (
        <>
            <Route
                path="/refund"
                component={() => <Navigate href={`/rescue${params}`} />}
            />
            <Route
                path="/refund/external"
                component={() => (
                    <Navigate href={`/rescue/external${params}`} />
                )}
            />
            <Route
                path="/refund/external/:type"
                component={() => (
                    <Navigate href={`/rescue/external/:type${params}`} />
                )}
            />
            <Route
                path="/refund/rescue/:id"
                component={() => (
                    <Navigate href={`/rescue/refund/:id${params}`} />
                )}
            />
        </>
    );
};

const cleanup = render(
    () => (
        <Router root={App}>
            <Route path="/" component={Hero} />
            <Route path="/swap" component={Create} />
            {/* Compatibility with link in Breez:
                                https://github.com/breez/breezmobile/blob/a1b0ffff902dfa2210af8fdb047b715535ff11e9/src/json/vendors.json#L30 */}
            <Route path="/swapbox" component={Create} />
            <Route path="/swap/:id" component={Pay} />
            <Route path="/swap/:id/claim" component={ClaimRescue} />
            <Route path="/backup" component={Backup} />
            <Route path="/backup/mnemonic" component={BackupMnemonic} />
            <Route path="/backup/mnemonic/verify" component={MnemonicVerify} />
            <Route path="/backup/verify" component={BackupVerify} />
            <Route
                path="/backup/verify/:type"
                component={BackupVerifyExisting}
            />
            <Route
                path="/swap/refund/evm/:asset/:txHash"
                component={RefundEvm}
            />
            <Route path="/error" component={() => <Error />} />
            <Route path="/rescue" component={Rescue} />
            <Route path="/rescue/external" component={RescueExternal} />
            <Route path="/rescue/external/:type" component={RescueExternal} />
            <Route path="/rescue/claim/:id" component={ClaimRescue} />
            <Route path="/rescue/refund/:id" component={RefundRescue} />
            {redirectRefundToRescue()}
            <Route path="/history" component={History} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy" component={Privacy} />
            <Route path="*404" component={NotFound} />
        </Router>
    ),
    document.getElementById("root"),
);

if (import.meta.hot) {
    log.info("Hot reload");
    import.meta.hot.dispose(cleanup);
}
