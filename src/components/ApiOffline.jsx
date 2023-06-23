import { useI18n } from "@solid-primitives/i18n";
import { online, wasmSupported } from "../signals";
import { fetchPairs } from "../helper";
import reload_svg from "../assets/reload.svg";

const ApiOffline = () => {
    const [t] = useI18n();
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
        </div>
    );
};

export default ApiOffline;
