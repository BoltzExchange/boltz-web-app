/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route, Routes } from "@solidjs/router";
import { I18nContext, createI18nContext, useI18n } from "@solid-primitives/i18n";

import App from "./App";
import Nav from "./Nav";
import Refund from "./Refund";
import dict from "./i18n";

const i18n_context = createI18nContext(dict, "en");

render(
  () => (
    <I18nContext.Provider value={i18n_context}>
        <Router>
          <Nav />
          <Routes>
            <Route path="/" component={App} />
            <Route path="/swap" component={App} />
            <Route path="/refund" component={Refund} />
          </Routes>
        </Router>
    </I18nContext.Provider>
  ),
  document.getElementById("root")
);
