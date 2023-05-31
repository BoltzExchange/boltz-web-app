import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [solidPlugin(), nodePolyfills()],
  server: {
    cors: { origin: "*" },
  },
  test: {
    browser: {
      enabled: true,
      name: 'firefox',
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
