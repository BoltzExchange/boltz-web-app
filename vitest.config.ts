import child from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import solidPlugin from "vite-plugin-solid";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const commitHash = child
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();

const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
) as {
    version: string;
};

export default defineConfig({
    plugins: [solidPlugin(), wasm(), topLevelAwait(), nodePolyfills()],
    resolve: {
        alias: {
            src: path.resolve(rootDir, "src"),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
        __GIT_COMMIT__: JSON.stringify(commitHash),
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./tests/setup.ts",
        pool: "forks",
        server: {
            deps: {
                inline: [/@solidjs\/router/],
            },
        },
    },
});
