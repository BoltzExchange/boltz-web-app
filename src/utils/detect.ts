import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

import { setHideHero } from "../Hero";
// import { isMobile, stringSerializer } from "../helper";
import { detectLanguage } from "../i18n/detect";
import { setInvoice, setOnchainAddress } from "../signals";
import { checkWasmSupported } from "./wasmSupport";
import { detectWebLNProvider } from "./webln";

const isIos = !!navigator.userAgent.match(/iphone|ipad/gi) || false;
const isMobile =
    isIos || !!navigator.userAgent.match(/android|blackberry/gi) || false;

console.log("isMobile", isMobile);
const defaultRef = isMobile ? "boltz_webapp_mobile" : "boltz_webapp_desktop";
const defaultEmbedRef = isMobile
    ? "boltz_webapp_embed_mobile"
    : "boltz_webapp_embed_desktop";

export const [embedded, setEmbedded] = createSignal(false);
export const [online, setOnline] = createSignal(true);
export const [wasmSupported, setWasmSupported] = createSignal(true);
export const [webln, setWebln] = createSignal(false);
export const [ref, setRef] = makePersisted(createSignal(defaultRef), {
    name: "ref",
    serialize: (value) => value,
    deserialize: (value) => value,
});

export const detect = () => {
    detectWebLNProvider().then((state: boolean) => setWebln(state));
    setWasmSupported(checkWasmSupported());
    detectLanguage();

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has("embed") && urlParams.get("embed") === "1") {
        setHideHero(true);
        setEmbedded(true);
        setRef(defaultEmbedRef);
    }

    if (urlParams.has("ref") && urlParams.get("ref") !== "") {
        setRef(urlParams.get("ref"));
    }

    if (urlParams.has("invoice") && urlParams.get("invoice") !== "") {
        setInvoice(urlParams.get("invoice"));
    }

    if (urlParams.has("bip21") && urlParams.get("bip21") !== "") {
        setOnchainAddress(urlParams.get("bip21"));
    }

    window.history.replaceState({}, document.title, window.location.pathname);
};
