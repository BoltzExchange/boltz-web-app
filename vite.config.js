import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import mkcert from "vite-plugin-mkcert";

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
});
