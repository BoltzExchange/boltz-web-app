import log from "loglevel";
import { onMount } from "solid-js";

import { config } from "./config";

declare global {
    interface Window {
        chatwootSettings: {
            darkMode: string;
        };
        chatwootSDK: {
            run: (config: { websiteToken: string; baseUrl: string }) => void;
        };
        $chatwoot: {
            setCustomAttributes: (attributes: { swapId: string }) => void;
        };
    }
}

export default function Chatwoot() {
    onMount(() => {
        const token = import.meta.env.VITE_CHATWOOT_TOKEN;
        const url = config.chatwootUrl;
        if (token !== undefined && url !== undefined) {
            const tag = "script";
            const script = document.createElement(tag);
            const parent = document.getElementsByTagName(tag)[0];
            script.src = url + "/packs/js/sdk.js";
            script.defer = true;
            script.async = true;
            parent.parentNode.insertBefore(script, parent);
            script.onload = function () {
                window.chatwootSettings = {
                    darkMode: "auto",
                };
                window.chatwootSDK.run({
                    websiteToken: token,
                    baseUrl: url,
                });
            };
        } else {
            log.warn("Chatwoot token or url not set");
        }
    });

    return "";
}
