/* @refresh reload */
import "./utils/patches";
import log from "loglevel";
import { render } from "solid-js/web";
import { Router, Route, Routes, Navigate } from "@solidjs/router";
import Pay from "./Pay";
import Nav from "./Nav";
import Hero from "./Hero";
import "./style/index.scss";
import Error from "./Error";
import Create from "./Create";
import Footer from "./Footer";
import Refund from "./Refund";
import History from "./History";
import NotFound from "./NotFound";
import Notification from "./Notification";
import { checkReferralId } from "./helper";
import { loglevel, network } from "./config";
import { swapChecker } from "./utils/swapChecker";
import { detectWebLNProvider } from "./utils/webln";
import { setWebln, setWasmSupported } from "./signals";
import { checkWasmSupported } from "./utils/wasmSupport";

log.setLevel(loglevel);

detectWebLNProvider().then((state) => setWebln(state));
setWasmSupported(checkWasmSupported());
checkReferralId();

swapChecker();

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
