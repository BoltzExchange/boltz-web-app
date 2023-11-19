/* @refresh reload */
import { Navigate, Route, Router, Routes } from "@solidjs/router";
import log from "loglevel";
import { createRoot } from "solid-js";
import { render } from "solid-js/web";

import Create from "./Create";
import Error from "./Error";
import Footer from "./Footer";
import Hero from "./Hero";
import History from "./History";
import Nav from "./Nav";
import NotFound from "./NotFound";
import Notification from "./Notification";
import Pay from "./Pay";
import Refund from "./Refund";
import { loglevel, network } from "./config";
import { Web3SignerProvider } from "./context/Web3";
import { checkReferralId } from "./helper";
import { detectLanguage } from "./i18n/detect";
import { setWasmSupported, setWebln } from "./signals";
import "./style/index.scss";
import "./utils/patches";
import { swapChecker } from "./utils/swapChecker";
import { checkWasmSupported } from "./utils/wasmSupport";
import { detectWebLNProvider } from "./utils/webln";

log.setLevel(loglevel);

detectWebLNProvider().then((state) => setWebln(state));
setWasmSupported(checkWasmSupported());
checkReferralId();
detectLanguage();

createRoot(() => {
    swapChecker();
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("./service-worker.js", { scope: "./" })
        .then((reg) => {
            log.info(`Registration succeeded. Scope is ${reg.scope}`);
        });
}

document.body.classList.remove("loading");

const cleanup = render(
    () => (
        <Router>
            <Nav network={network} />
            <Web3SignerProvider>
                <Routes>
                    <Route path="*" element={<Navigate href={"/404"} />} />
                    <Route path="/404" component={NotFound} />
                    <Route path="/" component={Hero} />
                    <Route path="/swap" component={Create} />
                    {/* Compatibility with link in Breez:
                        https://github.com/breez/breezmobile/blob/a1b0ffff902dfa2210af8fdb047b715535ff11e9/src/json/vendors.json#L30 */}
                    <Route path="/swapbox" component={Create} />
                    <Route path="/swap/:id" component={Pay} />
                    <Route path="/error" component={Error} />
                    <Route path="/refund" component={Refund} />
                    <Route path="/history" component={History} />
                </Routes>
            </Web3SignerProvider>
            <Notification />
            <Footer />
        </Router>
    ),
    document.getElementById("root"),
);

if (import.meta.hot) {
    console.log("Hot reload");
    import.meta.hot.dispose(cleanup);
}
