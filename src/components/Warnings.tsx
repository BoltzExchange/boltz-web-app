import { Show } from "solid-js";

import reload_svg from "../assets/reload.svg";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";

const Warnings = () => {
    const { t, online, fetchPairs, wasmSupported } = useGlobalContext();

    return (
        <div>
            <Show when={!online()}>
                <div id="offline" class="banner">
                    {t("api_offline_msg")}
                    <span class="icon-reload" onClick={() => fetchPairs()}>
                        <img src={reload_svg} />
                    </span>
                </div>
            </Show>
            <Show when={!wasmSupported()}>
                <div id="noWasm" class="banner">
                    {t("wasm_not_supported")}
                </div>
            </Show>
            <Show when={config.isBeta}>
                <div class="banner banner-yellow">{t("beta_caution")}</div>
            </Show>
            <Show when={config.isPro}>
                <div class="banner banner-yellow">{t("pro_banner")}</div>
            </Show>
        </div>
    );
};

export default Warnings;
