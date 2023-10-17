import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import t from "./i18n";
import "./style/nav.scss";
import locales from "./i18n/i18n.js";
import logo from "./assets/boltz.svg";
import Warnings from "./components/Warnings";
import { setI18n, hamburger, setHamburger } from "./signals";

const Nav = ({ network }) => {
    let timeout;

    return (
        <nav>
            <Warnings />
            <div class="nav-inner">
                <A id="logo" href="/">
                    <img src={logo} alt="boltz.exchange btc logo" />
                </A>
                <Show when={network !== "main"}>
                    <div id="network" class="btn btn-small">
                        {network}
                    </div>
                </Show>
                <div
                    id="languages"
                    onClick={(e) => e.currentTarget.classList.toggle("active")}
                    onMouseenter={() => {
                        if (timeout) {
                            clearTimeout(timeout);
                        }
                    }}
                    onMouseleave={(e) => {
                        timeout = setTimeout(() => {
                            e.target.classList.remove("active");
                        }, 300);
                    }}>
                    <span class="globe"></span>
                    <div class="dropdown">
                        <For each={Object.keys(locales)}>
                            {(lang) => (
                                <span
                                    class="lang"
                                    onClick={() => setI18n(lang)}>
                                    {locales[lang].language}
                                </span>
                            )}
                        </For>
                    </div>
                </div>
                <div id="collapse" class={hamburger() ? "active" : ""}>
                    <A href="/swap" onClick={() => setHamburger(false)}>
                        {t("swap")}
                    </A>
                    <A href="/refund" onClick={() => setHamburger(false)}>
                        {t("refund")}
                    </A>
                    <A href="/history" onClick={() => setHamburger(false)}>
                        {t("history")}
                    </A>
                    <a
                        class="external"
                        target="_blank"
                        href="https://blog.boltz.exchange/">
                        {t("blog")}
                    </a>
                    <a
                        class="external"
                        target="_blank"
                        href="https://docs.boltz.exchange/">
                        {t("documentation")}
                    </a>
                    <a
                        class="external"
                        target="_blank"
                        href="https://discord.gg/QBvZGcW">
                        {t("help")}
                    </a>
                    <a
                        class="external"
                        target="_blank"
                        href="http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/">
                        {t("onion")}
                    </a>
                </div>
                <svg
                    id="hamburger"
                    viewBox="0 0 100 100"
                    width="45"
                    class={hamburger() ? "active" : ""}
                    onClick={() => setHamburger(!hamburger())}>
                    <path
                        class="line top"
                        d="m 70,33 h -40 c 0,0 -8.5,-0.149796 -8.5,8.5 0,8.649796 8.5,8.5 8.5,8.5 h 20 v -20"
                    />
                    <path class="line middle" d="m 70,50 h -40" />
                    <path
                        class="line bottom"
                        d="m 30,67 h 40 c 0,0 8.5,0.149796 8.5,-8.5 0,-8.649796 -8.5,-8.5 -8.5,-8.5 h -20 v 20"
                    />
                </svg>
            </div>
        </nav>
    );
};

export default Nav;
