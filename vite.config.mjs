import * as child from "child_process";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import solidPlugin from "vite-plugin-solid";

const commitHash = child
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();

export default defineConfig({
    plugins: [solidPlugin(), mkcert(), nodePolyfills()],
    server: {
        https: true,
        cors: { origin: "*" },
    },
    build: {
        commonjsOptions: {
            transformMixedEsModules: true,
        },
        // rollupOptions: {
        //     output: {
        //         manualChunks: {
        //             bitcoin: [
        //                 "bitcoinjs-lib",
        //                 "liquidjs-lib",
        //                 "boltz-core",
        //                 "ethers",
        //                 "@vulpemventures/secp256k1-zkp",
        //                 "@bitcoinerlab/secp256k1",
        //                 "ecpair",
        //                 "create-hmac",
        //             ],
        //         },
        //     },
        // },
    },
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
        __GIT_COMMIT__: JSON.stringify(commitHash),
    },
});
