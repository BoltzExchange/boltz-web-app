import { A } from "@solidjs/router";
import { IoLanguage } from "solid-icons/io";
import { OcLinkexternal2 } from "solid-icons/oc";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

import Warnings from "../components/Warnings";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";
import locales from "../i18n/i18n";
import "../style/nav.scss";
import ExternalLink from "./ExternalLink";

const Nav = (props: { network: string; isPro?: boolean }) => {
    let languagesRef: HTMLDivElement | undefined;

    const { t, setHideHero, setI18nConfigured } = useGlobalContext();
    const [hamburger, setHamburger] = createSignal(false);
    const [languageMenu, setLanguageMenu] = createSignal(false);

    const closeLanguageMenu = (event: MouseEvent) => {
        const target = event.target;

        if (target instanceof Node && languagesRef?.contains(target)) {
            return;
        }

        setLanguageMenu(false);
    };

    onMount(() => {
        document.addEventListener("click", closeLanguageMenu);
    });

    onCleanup(() => {
        document.removeEventListener("click", closeLanguageMenu);
    });

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
                        {props.network.toUpperCase()}
                    </div>
                </Show>
                <Show when={props.isPro}>
                    <div id="network" boltz-theme="pro" class="btn btn-small">
                        {t("pro").toUpperCase()}
                    </div>
                </Show>
                <div
                    id="languages"
                    ref={languagesRef}
                    classList={{ active: languageMenu() }}>
                    <button
                        type="button"
                        class="language-toggle"
                        aria-label={t("language")}
                        aria-haspopup="menu"
                        aria-expanded={languageMenu()}
                        onClick={() => setLanguageMenu((open) => !open)}>
                        <IoLanguage size={19} />
                    </button>
                    <div class="dropdown" role="menu">
                        <For each={Object.keys(locales)}>
                            {(lang) => (
                                <button
                                    type="button"
                                    class="lang"
                                    role="menuitem"
                                    onClick={() => {
                                        setI18nConfigured(lang);
                                        setLanguageMenu(false);
                                    }}>
                                    {
                                        locales[lang as keyof typeof locales]
                                            .language
                                    }
                                </button>
                            )}
                        </For>
                    </div>
                </div>
                <div id="collapse" class={hamburger() ? "active" : ""}>
                    <A href="/swap" onClick={() => setHamburger(false)}>
                        {t("swap")}
                    </A>
                    <A href="/rescue" onClick={() => setHamburger(false)}>
                        {t("rescue")}
                    </A>
                    <A href="/history" onClick={() => setHamburger(false)}>
                        {t("history")}
                    </A>
                    <A href="/products" onClick={() => setHamburger(false)}>
                        {t("products")}
                    </A>
                    <Show when={config.supportUrl}>
                        <ExternalLink class="external" href={config.supportUrl}>
                            {t("help")}
                            <OcLinkexternal2 size={23} />
                        </ExternalLink>
                    </Show>
                    <Show when={config.docsUrl}>
                        <ExternalLink class="external" href={config.docsUrl}>
                            {t("docs")}
                            <OcLinkexternal2 size={23} />
                        </ExternalLink>
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
