import { createEffect } from "solid-js";
import { render } from "solid-js/web";
import { A } from "@solidjs/router";

import { useI18n } from "@solid-primitives/i18n";
import { setI18n } from "./signals";

import "./nav.css";
import logo from "./assets/boltz-btc-logo.svg";


const Nav = () => {
  const [t, { add, locale, dict }] = useI18n();

  const set_local = (locale_code) => {
      locale(locale_code);
      setI18n(locale_code);
  };

  return (
    <nav>
      <svg class="hamburger" viewBox="0 0 100 100" width="50" onclick="this.classList.toggle('active')">
          <path class="line top" d="m 70,33 h -40 c 0,0 -8.5,-0.149796 -8.5,8.5 0,8.649796 8.5,8.5 8.5,8.5 h 20 v -20" />
          <path class="line middle" d="m 70,50 h -40" />
          <path class="line bottom" d="m 30,67 h 40 c 0,0 8.5,0.149796 8.5,-8.5 0,-8.649796 -8.5,-8.5 -8.5,-8.5 h -20 v 20" />
      </svg>

      <A id="logo" href="/">
        <img src={logo} alt="boltz exchange btc logo" />
      </A>

      <div class="collapse">
          <A href="/swap">{t("swap")}</A>
          <A href="/refund">{t("refund")}</A>
          <a
            class="external"
            target="_blank"
            href="https://docs.boltz.exchange/en/latest/"
            >{t("documentation")}</a
          >
          <a
            class="external"
            target="_blank"
            href="https://docs.boltz.exchange/"
            >{t("help")}</a
          >
          <a
            class="external"
            target="_blank"
            href="http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/"
            >{t("onion")}</a
          >
      </div>
      <div id="languages">
          <span onClick={() => set_local("en")}>English</span>
          <div class="dropdown">
              <span class="lang" onClick={() => set_local("en")}>English</span>
              <span class="lang" onClick={() => set_local("de")}>Deutsch</span>
              <span class="lang" onClick={() => set_local("es")}>Español</span>
          </div>
      </div>

    </nav>
  );
};
          // <a
          //   class="external"
          //   target="_blank"
          //   href="https://amboss.space/node/026165850492521f4ac8abd9bd8088123446d126f648ca35e60f88177dc149ceb2"
          //   >{t("lightning_node")}</a
          // >

export default Nav;
