/* @refresh reload */
import "./utils/patches";
import { render } from "solid-js/web";
import { Router, Route, Routes } from "@solidjs/router";
import { I18nContext } from "@solid-primitives/i18n";
import { setWebln, setWasmSupported } from "./signals";
import { detectWebLNProvider, checkReferralId } from "./helper";
import log from "loglevel";
import Create from "./Create";
import Pay from "./Pay";
import Nav from "./Nav";
import Notification from "./Notification";
import Footer from "./Footer";
import Refund from "./Refund";
import createI18n from "./i18n";
import History from "./History";
import { loglevel } from "./config";
import { checkWasmSupported } from "./utils/wasmSupport";
import "./css/index.css";

log.setLevel(loglevel);

detectWebLNProvider().then((state) => setWebln(state));
setWasmSupported(checkWasmSupported());
checkReferralId();

// <Route path="/" component={Hero} />
const cleanup = render(
    () => (
        <I18nContext.Provider value={createI18n()}>
            <Router>
                <Nav />
                <Routes>
                    <Route path="/" component={Create} />
                    <Route path="/swap" component={Create} />
                    <Route path="/swap/:id" component={Pay} />
                    <Route path="/refund" component={Refund} />
                    <Route path="/history" component={History} />
                </Routes>
                <Notification />
                <Footer />
            </Router>
        </I18nContext.Provider>
    ),
    document.getElementById("root")
);

if (import.meta.hot) {
    console.log("Hot reload");
    import.meta.hot.dispose(cleanup);
}
