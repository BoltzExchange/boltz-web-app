import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    cors: { origin: "*" },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
