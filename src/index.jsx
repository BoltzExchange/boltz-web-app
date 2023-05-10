/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route, Routes } from "@solidjs/router";
import { I18nContext, createI18nContext } from "@solid-primitives/i18n";
import { i18n, setWebln } from "./signals";
import { detectWebLNProvider } from "./helper";
import log from 'loglevel';
import Create from "./Create";
import Pay from "./Pay";
import Nav from "./Nav";
import Notification from "./Notification";
import Footer from "./Footer";
// import Hero from "./Hero";
import Refund from "./Refund";
import History from "./History";
import "./css/index.css";

import { loglevel } from "./config";

log.setLevel(loglevel);

import dict from "./i18n";
const i18n_context = createI18nContext(dict, i18n());

detectWebLNProvider().then(() => setWebln(true));

// <Route path="/" component={Hero} />
render(
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
