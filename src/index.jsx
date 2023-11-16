/* @refresh reload */
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
import { checkReferralId } from "./helper";
import { detectLanguage } from "./i18n/detect";
import { setWasmSupported, setWebln } from "./signals";
import "./style/index.scss";
import "./utils/patches";
import { swapChecker } from "./utils/swapChecker";
import { checkWasmSupported } from "./utils/wasmSupport";
import { detectWebLNProvider } from "./utils/webln";
import { Navigate, Route, Router, Routes } from "@solidjs/router";
import log from "loglevel";
import { render } from "solid-js/web";

log.setLevel(loglevel);

detectWebLNProvider().then((state) => setWebln(state));
setWasmSupported(checkWasmSupported());
checkReferralId();
detectLanguage();

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
