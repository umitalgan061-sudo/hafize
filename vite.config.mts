import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const typedDevEntryPlugin = (): Plugin => ({
  name: 'hafize-typed-dev-entries',
  transformIndexHtml(html, context) {
    if (context.server) {
      return html
        .replaceAll('/typed-build/app-runtime.js', '/typed/app-runtime.mts')
        .replaceAll('/typed-build/prompt-library-smart-fill.js', '/prompt-library-smart-fill.mts')
        .replaceAll('/typed-build/prompt-library-command-palette.js', '/prompt-library-command-palette.mts')
        .replaceAll('/typed-build/scheduled-tasks-countdown.js', '/scheduled-tasks-countdown.mts')
        .replaceAll('/typed-build/prompt-library-smart-fill-hints.js', '/prompt-library-smart-fill-hints.mts');
    }
    return html;
  }
});

export default defineConfig({
  root: resolve(ROOT, 'public'),
  publicDir: false,
  plugins: [typedDevEntryPlugin()],
  server: {
    host: '127.0.0.1',
    fs: { strict: true },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: false
      }
    }
  },
  build: {
    lib: {
      entry: {
        'app-runtime': resolve(ROOT, 'public/typed/app-runtime.mts'),
        'prompt-library-smart-fill': resolve(ROOT, 'public/prompt-library-smart-fill.mts'),
        'prompt-library-command-palette': resolve(ROOT, 'public/prompt-library-command-palette.mts'),
        'scheduled-tasks-countdown': resolve(ROOT, 'public/scheduled-tasks-countdown.mts'),
        'prompt-library-smart-fill-hints': resolve(ROOT, 'public/prompt-library-smart-fill-hints.mts')
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    outDir: resolve(ROOT, 'public/typed-build'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]'
      }
    }
  }
});
