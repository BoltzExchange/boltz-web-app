import { A } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";

import logo from "../assets/boltz.svg";
import Warnings from "../components/Warnings";
import { discordUrl, docsUrl, torUrl } from "../config";
import { useGlobalContext } from "../context/Global";
import locales from "../i18n/i18n";
import "../style/nav.scss";

const Nav = ({ network }) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const { t, setHideHero, setI18nConfigured } = useGlobalContext();
    const [hamburger, setHamburger] = createSignal(false);

    return (
        <nav>
            <Warnings />
            <div class="nav-inner">
                <A id="logo" href="/" onClick={() => setHideHero(false)}>
                    <img src={logo} alt="boltz.exchange logo" />
                </A>
                <Show when={network !== "main"}>
                    <div id="network" class="btn btn-small">
                        {network}
                    </div>
                </Show>
                <div
                    id="languages"
                    onClick={(e) => e.currentTarget.classList.toggle("active")}
                    onMouseEnter={() => {
                        if (timeout) {
                            clearTimeout(timeout);
                        }
                    }}
                    onMouseLeave={(e) => {
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
                                    onClick={() => setI18nConfigured(lang)}>
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
                    <Show when={docsUrl}>
                        <a class="external" target="_blank" href={docsUrl}>
                            {t("documentation")}
                        </a>
                    </Show>
                    <Show when={discordUrl}>
                        <a class="external" target="_blank" href={discordUrl}>
                            {t("help")}
                        </a>
                    </Show>
                    <Show when={torUrl}>
                        <a class="external" target="_blank" href={torUrl}>
                            {t("onion")}
                        </a>
                    </Show>
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
