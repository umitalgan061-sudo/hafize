import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPED_ENTRIES = {
  'app-runtime': 'public/typed/app-runtime.ts',
  'platform-runtime': 'public/typed/platform-runtime.ts',
  'prompt-library-smart-fill': 'public/prompt-library-smart-fill.ts',
  'prompt-library-command-palette': 'public/prompt-library-command-palette.ts',
  'scheduled-tasks-countdown': 'public/scheduled-tasks-countdown.ts',
  'prompt-library-smart-fill-hints': 'public/prompt-library-smart-fill-hints.ts'
} as const;
const TYPED_NAMES = Object.keys(TYPED_ENTRIES) as Array<keyof typeof TYPED_ENTRIES>;

const typedDevEntryPlugin = (): Plugin => ({
  name: 'hafize-typed-dev-entries',
  transformIndexHtml(html, context) {
    if (!context.server) return html;
    return TYPED_NAMES.reduce((source, name) => source.replaceAll(`/typed-build/${name}.js`, `/${TYPED_ENTRIES[name].replace(/^public\//, '')}`), html);
  }
});

export default defineConfig({
  root: resolve(ROOT, 'public'),
  publicDir: false,
  plugins: [typedDevEntryPlugin()],
  server: {
    host: '127.0.0.1',
    fs: { strict: true },
    proxy: { '/api': { target: 'http://127.0.0.1:4173', changeOrigin: false } }
  },
  build: {
    lib: { entry: Object.fromEntries(TYPED_NAMES.map((name) => [name, resolve(ROOT, TYPED_ENTRIES[name])])), formats: ['es'], fileName: (_format, entryName) => `${entryName}.js` },
    outDir: resolve(ROOT, 'public/typed-build'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: { output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js', assetFileNames: '[name]-[hash][extname]' } }
  }
});
