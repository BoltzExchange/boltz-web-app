import { defineConfig, loadEnv } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { pluginSass } from "@rsbuild/plugin-sass";
import { pluginSolid } from "@rsbuild/plugin-solid";
import child from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const commitHash = child
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();

const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
);

const configFile = path.resolve(rootDir, "src/config.ts");

if (!fs.existsSync(configFile)) {
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
    process.exit(1);
}

try {
    child.execSync("node index-template-vars.mjs", {
        stdio: "inherit",
    });
} catch (error) {
    console.error("❌ Failed to generate index.html", error);
    process.exit(1);
}

const { publicVars } = loadEnv({ prefixes: ["VITE_"] });

export default defineConfig({
    plugins: [
        pluginBabel({
            include: /\.(?:jsx|tsx)$/,
        }),
        pluginSolid(),
        pluginSass(),
        pluginNodePolyfill(),
        {
            name: "copy-index-to-404",
            setup(api) {
                api.onAfterBuild(() => {
                    const indexPath = path.resolve(rootDir, "dist/index.html");
                    if (fs.existsSync(indexPath)) {
                        fs.copyFileSync(
                            indexPath,
                            path.resolve(rootDir, "dist/404.html"),
                        );
                    }
                });
            },
        },
    ],
    html: {
        template: "./index.html",
    },
    source: {
        entry: {
            index: "./src/index.tsx",
        },
        define: {
            ...publicVars,
            __APP_VERSION__: JSON.stringify(packageJson.version),
            __GIT_COMMIT__: JSON.stringify(commitHash),
        },
    },
    resolve: {
        alias: {
            src: path.resolve(rootDir, "src"),
        },
    },
    server: {
        cors: {
            origin: "*",
        },
        port: 5173,
    },
    tools: {
        rspack: {
            experiments: {
                asyncWebAssembly: true,
            },
            node: {
                __dirname: false,
                __filename: false,
            },
            resolve: {
                roots: [path.resolve(rootDir, "public")],
            },
        },
    },
});
