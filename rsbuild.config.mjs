/* eslint-env node */
import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { pluginSass } from "@rsbuild/plugin-sass";
import { pluginSolid } from "@rsbuild/plugin-solid";
import * as child from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commitHash = child
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();

const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf8"),
);

const configFile = path.resolve(__dirname, "src/config.ts");

if (!fs.existsSync(configFile)) {
    // eslint-disable-next-line no-console
    console.error(`
❌ Missing configuration file: src/config.ts

Please run one of the following commands to generate a config file:
    - \x1b[36mnpm run mainnet\x1b[0m
    - \x1b[36mnpm run regtest\x1b[0m
    - \x1b[36mnpm run testnet\x1b[0m
    - \x1b[36mnpm run beta\x1b[0m
    - \x1b[36mnpm run pro\x1b[0m
  
Then start the dev server again.
  `);
    // eslint-disable-next-line no-undef
    process.exit(1);
}

const indexHtml = path.resolve(__dirname, "index.html");
if (!fs.existsSync(indexHtml)) {
    try {
        child.execSync("node index-template-vars.mjs --regular", {
            stdio: "inherit",
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("❌ Failed to generate index.html", err);
        // eslint-disable-next-line no-undef
        process.exit(1);
    }
}

export default defineConfig({
    plugins: [
        pluginNodePolyfill(),
        pluginSass({
            sassLoaderOptions: {
                api: "modern-compiler",
            },
        }),
        pluginBabel(),
        pluginSolid(),
    ],
    html: {
        template: path.resolve(__dirname, "index.html"),
        inject: "body",
    },
    source: {
        entry: {
            index: path.resolve(__dirname, "src/index.tsx"),
        },
        exclude: ["node_modules"],
        define: {
            __APP_VERSION__: `"${packageJson.version}"`,
            __GIT_COMMIT__: `"${commitHash}"`,
        },
    },
    resolve: {
        alias: {
            src: path.resolve(__dirname, "src"),
        },
    },
    server: {
        port: 5173,
        cors: { origin: "*" },
    },
    tools: {
        rspack: {
            experiments: {
                topLevelAwait: true,
            },
        },
    },
});
