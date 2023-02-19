import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import nodePolyfills from 'rollup-plugin-node-polyfills';

export default defineConfig({
  base: '',
  plugins: [
    solidPlugin(),
    nodePolyfills({crypto: true, stream: true}),
  ],
  build: {
    rollupOptions: {
      plugins: [nodePolyfills()],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true
        }),
      ]
    }
  }
});
