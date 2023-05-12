/* @refresh reload */
import "./utils/patches";
import { render } from "solid-js/web";
import { Router, Route, Routes } from "@solidjs/router";
import { I18nContext, createI18nContext } from "@solid-primitives/i18n";
import { i18n, setWebln } from "./signals";
import { detectWebLNProvider } from "./helper";
import log from "loglevel";
import Create from "./Create";
import Pay from "./Pay";
import Nav from "./Nav";
import Notification from "./Notification";
import Footer from "./Footer";
import Refund from "./Refund";
import History from "./History";
import { loglevel } from "./config";
import dict from "./i18n";
import "./css/index.css";

log.setLevel(loglevel);

const i18n_context = createI18nContext(dict, i18n());

detectWebLNProvider().then((state) => setWebln(state));

// <Route path="/" component={Hero} />
const cleanup = render(
    () => (
        <I18nContext.Provider value={i18n_context}>
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
