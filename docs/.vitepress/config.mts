import { defineConfig } from "vitepress";

const docsRoot = "https://docs.boltz.exchange";

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Boltz Web App",
    description: "Boltz Web App Docs",
    themeConfig: {
        logo: "./assets/logo.svg",
        search: {
            provider: "local",
        },
        nav: [{ text: "Home", link: docsRoot }],
        sidebar: [
            {
                items: [
                    { text: "🖥️ Run from Source", link: "/index" },
                    { text: "📲 Install as App", link: "/pwa" },
                    { text: "🔍 URL Parameters", link: "/urlParams" },

                    { text: "🔙 Home", link: docsRoot },
                ],
            },
        ],
        socialLinks: [
            {
                icon: "github",
                link: "https://github.com/BoltzExchange/boltz-web-app",
            },
        ],
    },
    // Ignore dead links to localhost
    ignoreDeadLinks: [/https?:\/\/localhost/],
});
