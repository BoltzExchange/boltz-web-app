import * as child from "child_process";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import solidPlugin from "vite-plugin-solid";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const commitHash = child
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();

export default defineConfig({
    plugins: [
        solidPlugin(),
        wasm(),
        topLevelAwait(),
        mkcert(),
        nodePolyfills(),
    ],
    server: {
        https: true,
        cors: { origin: "*" },
    },
    base: "/",
    build: {
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: "modern-compiler",
            },
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
        __GIT_COMMIT__: JSON.stringify(commitHash),
    },
});
