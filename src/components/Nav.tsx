import { A } from "@solidjs/router";
import { BsGlobe } from "solid-icons/bs";
import { OcLinkexternal2 } from "solid-icons/oc";
import { For, Show, createSignal } from "solid-js";

import Warnings from "../components/Warnings";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";
import locales from "../i18n/i18n";
import "../style/nav.scss";

const Nav = (props: { network: string; isPro?: boolean }) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const { t, setHideHero, setI18nConfigured } = useGlobalContext();
    const [hamburger, setHamburger] = createSignal(false);

    return (
        <nav>
            <Warnings />
            <div class="nav-inner">
                <A id="logo" href="/" onClick={() => setHideHero(false)}>
                    <div
                        id="logo-mask"
                        boltz-theme={props.isPro ? "pro" : "default"}
                        role="img"
                        aria-label="Boltz logo"
                    />
                </A>
                <Show when={props.network !== "mainnet"}>
                    <div id="network" class="btn btn-small">
                        {props.network}
                    </div>
                </Show>
                <Show when={props.isPro}>
                    <div id="network" boltz-theme="pro" class="btn btn-small">
                        {t("pro")}
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
                    <span class="globe">
                        <BsGlobe size={19} />
                    </span>
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

                    <Show when={config.supportUrl}>
                        <a
                            class="external"
                            target="_blank"
                            href={config.supportUrl}>
                            {t("help")}
                            <OcLinkexternal2 size={23} />
                        </a>
                    </Show>
                    <Show when={config.docsUrl}>
                        <a
                            class="external"
                            target="_blank"
                            href={config.docsUrl}>
                            {t("documentation")}
                            <OcLinkexternal2 size={23} />
                        </a>
                    </Show>
                    <Show when={config.torUrl}>
                        <a
                            class="external"
                            target="_blank"
                            href={config.torUrl}>
                            {t("onion")}
                            <OcLinkexternal2 size={23} />
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
