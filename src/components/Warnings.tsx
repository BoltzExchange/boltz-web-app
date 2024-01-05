import { Show } from "solid-js";

import reload_svg from "../assets/reload.svg";
import { isBeta } from "../config";
import t from "../i18n";
import { online, wasmSupported } from "../signals";
import { fetchPairs } from "../utils/helper";

const Warnings = () => {
    return (
        <div>
            <Show when={!online()}>
                <div id="offline" class="banner">
                    {t("api_offline_msg")}
                    <span class="icon-reload" onClick={fetchPairs}>
                        <img src={reload_svg} />
                    </span>
                </div>
            </Show>
            <Show when={!wasmSupported()}>
                <div id="noWasm" class="banner">
                    {t("wasm_not_supported")}
                </div>
            </Show>
            <Show when={isBeta}>
                <div class="banner banner-yellow">{t("beta_caution")}</div>
            </Show>
        </div>
    );
};

export default Warnings;
