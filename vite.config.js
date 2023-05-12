import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  assetsInclude: ['**/boltz-preview.jpg'],
  plugins: [solidPlugin(), nodePolyfills()],
  server: {
    cors: { origin: "*" },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
