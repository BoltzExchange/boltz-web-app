import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineConfig } from "vitepress";

const docsRoot = "https://docs.boltz.exchange";
const siteUrl = "https://web.docs.boltz.exchange";

const sidebarItems = [
    { text: "🖥️ Run from Source", link: "/index" },
    { text: "📲 Install as App", link: "/pwa" },
    { text: "🔍 URL Parameters", link: "/urlParams" },
    { text: "🏠 Docs Home", link: docsRoot, target: "_self" },
];

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Boltz Web App",
    description: "Boltz Web App Docs",
    head: [["link", { rel: "icon", href: "/assets/logo.svg" }]],
    themeConfig: {
        logo: "/assets/logo.svg",
        search: {
            provider: "local",
            options: {
                detailedView: true,
            },
        },
        nav: [{ text: "🏠 Docs Home", link: docsRoot, target: "_self" }],
        sidebar: [{ items: sidebarItems }],
        socialLinks: [
            {
                icon: "github",
                link: "https://github.com/BoltzExchange/boltz-web-app",
            },
        ],
    },
    // Ignore dead links to localhost
    ignoreDeadLinks: [/https?:\/\/localhost/],

    async buildEnd(siteConfig) {
        await Promise.all(
            siteConfig.pages.map(async (page) => {
                const src = join(siteConfig.srcDir, page);
                const dest = join(siteConfig.outDir, page);
                await mkdir(dirname(dest), { recursive: true });
                await copyFile(src, dest);
            }),
        );

        const links = sidebarItems
            .filter((item) => item.link.startsWith("/"))
            .map((item) => `- [${item.text}](${siteUrl}${item.link}.md)`)
            .join("\n");

        await writeFile(
            join(siteConfig.outDir, "llms.txt"),
            `# Boltz Web App\n\n> Boltz Web App Docs\n\n## Docs\n\n${links}\n`,
        );
    },
});
