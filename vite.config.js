import * as child from "child_process";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import mkcert from "vite-plugin-mkcert";
import solidPlugin from "vite-plugin-solid";

const commitHash = child
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();

export default defineConfig({
    plugins: [solidPlugin(), nodePolyfills(), mkcert()],
    server: {
        https: true,
        cors: { origin: "*" },
    },
    build: {
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
        __GIT_COMMIT__: JSON.stringify(commitHash),
    },
});
