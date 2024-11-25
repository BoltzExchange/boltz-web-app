import { config } from "./config";
import { usePayContext } from "./context/Pay";
import { createEffect, onMount } from "solid-js";

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
            script.onload = function() {
                window.chatwootSettings = {
                    darkMode: "auto"
                };
                window.chatwootSDK.run({
                    websiteToken: token,
                    baseUrl: url
                });
            };
        }
    });

    const { swap } = usePayContext();

    createEffect(() => {
        if (swap() !== null) {
            window.$chatwoot.setCustomAttributes({
                swapId: swap().id
            });
        }
    });

    return "";
}