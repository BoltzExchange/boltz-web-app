/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route, Routes } from "@solidjs/router";
import App from "./App";
import Nav from "./Nav";
import Refund from "./Refund";

render(
  () => (
    <Router>
      <Nav />
      <Routes>
        <Route path="/" component={App} />
        <Route path="/swap" component={App} />
        <Route path="/refund" component={Refund} />
      </Routes>
    </Router>
  ),
  document.getElementById("root")
);
