import { render } from "solid-js/web";
import { A } from "@solidjs/router";
import "./nav.css";
import logo from "./assets/boltz-btc-logo.svg";

const Nav = () => {
  return (
    <nav>
      <svg class="hamburger hamRotate" viewBox="0 0 100 100" width="50" onclick="this.classList.toggle('active')">
          <path class="line top" d="m 70,33 h -40 c 0,0 -8.5,-0.149796 -8.5,8.5 0,8.649796 8.5,8.5 8.5,8.5 h 20 v -20" />
          <path class="line middle" d="m 70,50 h -40" />
          <path class="line bottom" d="m 30,67 h 40 c 0,0 8.5,0.149796 8.5,-8.5 0,-8.649796 -8.5,-8.5 -8.5,-8.5 h -20 v 20" />
      </svg>

      <A id="logo" href="/">
        <img src={logo} alt="boltz exchange btc logo" />
      </A>

      <div class="collapse">
          <A href="/swap">Swap</A>
          <A href="/refund">Refund</A>
          <a
            class="external"
            target="_blank"
            href="https://amboss.space/node/026165850492521f4ac8abd9bd8088123446d126f648ca35e60f88177dc149ceb2"
            >Lightning Node</a
          >
          <a
            class="external"
            target="_blank"
            href="https://docs.boltz.exchange/en/latest/"
            >Documentation</a
          >
      </div>

    </nav>
  );
};

export default Nav;
