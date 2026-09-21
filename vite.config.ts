import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const typedDevEntryPlugin = (): Plugin => ({
  name: 'hafize-typed-dev-entries',
  transformIndexHtml(html, context) {
    if (context.server) {
      return html
        .replaceAll('/typed-build/app-runtime.js', '/typed/app-runtime.ts')
        .replaceAll('/typed-build/prompt-library-smart-fill.js', '/prompt-library-smart-fill.ts')
        .replaceAll('/typed-build/prompt-library-command-palette.js', '/prompt-library-command-palette.ts')
        .replaceAll('/typed-build/scheduled-tasks-countdown.js', '/scheduled-tasks-countdown.ts')
        .replaceAll('/typed-build/prompt-library-smart-fill-hints.js', '/prompt-library-smart-fill-hints.ts')
        .replaceAll('/typed-build/prompt-library.js', '/prompt-library.ts')
        .replaceAll('/typed-build/prompt-library-enhancements.js', '/prompt-library-enhancements.ts')
        .replaceAll('/typed-build/prompt-library-usage.js', '/prompt-library-usage.ts')
        .replaceAll('/typed-build/ui-shell.js', '/ui-shell.ts')
        .replaceAll('/typed-build/workspace-navigation.js', '/workspace-navigation.ts');
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
        'app-runtime': resolve(ROOT, 'public/typed/app-runtime.ts'),
        'prompt-library-smart-fill': resolve(ROOT, 'public/prompt-library-smart-fill.ts'),
        'prompt-library-command-palette': resolve(ROOT, 'public/prompt-library-command-palette.ts'),
        'scheduled-tasks-countdown': resolve(ROOT, 'public/scheduled-tasks-countdown.ts'),
        'prompt-library-smart-fill-hints': resolve(ROOT, 'public/prompt-library-smart-fill-hints.ts'),
        'prompt-library': resolve(ROOT, 'public/prompt-library.ts'),
        'prompt-library-enhancements': resolve(ROOT, 'public/prompt-library-enhancements.ts'),
        'prompt-library-usage': resolve(ROOT, 'public/prompt-library-usage.ts'),
        'ui-shell': resolve(ROOT, 'public/ui-shell.ts'),
        'workspace-navigation': resolve(ROOT, 'public/workspace-navigation.ts')
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
