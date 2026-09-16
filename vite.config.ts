import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPED_PATHS = {
  'app-runtime': 'public/typed/app-runtime.ts',
  'chat-composer-features': 'public/chat-composer-features.ts',
  'chat-drafts': 'public/chat-drafts.ts',
  'chat-history-search': 'public/chat-history-search.ts',
  'chat-history-export': 'public/chat-history-export.ts',
  'chat-history-management': 'public/chat-history-management.ts',
  'prompt-library-compat': 'public/prompt-library-compat.ts',
  'prompt-library-smart-fill': 'public/prompt-library-smart-fill.ts',
  'prompt-library-command-palette': 'public/prompt-library-command-palette.ts',
  'prompt-library-smart-fill-hints': 'public/prompt-library-smart-fill-hints.ts',
  'prompt-library-keyboard': 'public/prompt-library-keyboard.ts',
  'prompt-library-starters': 'public/prompt-library-starters.ts',
  'prompt-library-usage': 'public/prompt-library-usage.ts',
  'prompt-library-enhancements': 'public/prompt-library-enhancements.ts',
  'scheduled-tasks': 'public/scheduled-tasks.ts',
  'scheduled-tasks-countdown': 'public/scheduled-tasks-countdown.ts',
  'settings-workspace': 'public/settings-workspace.ts',
  'voice-input': 'public/voice-input.ts',
  'voice-output': 'public/voice-output.ts',
  'workspace-navigation': 'public/workspace-navigation.ts',
  'ui-shell': 'public/ui-shell.ts'
} as const;

const TYPED_ENTRIES = Object.keys(TYPED_PATHS) as Array<keyof typeof TYPED_PATHS>;
const typedDevEntryPlugin = (): Plugin => ({
  name: 'hafize-typed-dev-entries',
  transformIndexHtml(html, context) {
    if (!context.server) return html;
    return TYPED_ENTRIES.reduce(
      (source, name) => source.replaceAll(`/typed-build/${name}.js`, `/${TYPED_PATHS[name].replace(/^public\//, '')}`),
      html
    );
  }
});

const entry = Object.fromEntries(TYPED_ENTRIES.map((name) => [name, resolve(ROOT, TYPED_PATHS[name])]));
export default defineConfig({
  root: resolve(ROOT, 'public'),
  publicDir: false,
  plugins: [typedDevEntryPlugin()],
  server: { host: '127.0.0.1', fs: { strict: true }, proxy: { '/api': { target: 'http://127.0.0.1:4173', changeOrigin: false } } },
  build: {
    lib: { entry, formats: ['es'], fileName: (_format, entryName) => `${entryName}.js` },
    outDir: resolve(ROOT, 'public/typed-build'), emptyOutDir: true, sourcemap: true, target: 'es2022',
    rollupOptions: { output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js', assetFileNames: '[name]-[hash][extname]' } }
  }
});
