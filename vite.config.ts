import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPED_ENTRIES = [
  'app-runtime','prompt-library-smart-fill','prompt-library-command-palette','prompt-library-smart-fill-hints','scheduled-tasks-countdown','prompt-library-usage','prompt-library-starters','prompt-library-keyboard',
  'auth','browser-platform','chat-composer-features','chat-drafts','voice-output','workspace-navigation','chat-history-search','chat-history-management','chat-history-export','composer-history','settings-workspace','ui-shell','scheduled-tasks','voice-input','screen-share','hands-free','conversation-workspace','runtime-health','message-workspace'
] as const;
const typedDevEntryPlugin = (): Plugin => ({
  name: 'hafize-typed-dev-entries',
  transformIndexHtml(html, context) { if (!context.server) return html; return TYPED_ENTRIES.reduce((source, name) => source.replaceAll(`/typed-build/${name}.js`, `/typed/${name}.ts`), html); }
});
const entry = Object.fromEntries(TYPED_ENTRIES.map((name) => [name, resolve(ROOT, `public/typed/${name}.ts`)]));
export default defineConfig({ root: resolve(ROOT, 'public'), publicDir: false, plugins: [typedDevEntryPlugin()], server: { host: '127.0.0.1', fs: { strict: true }, proxy: { '/api': { target: 'http://127.0.0.1:4173', changeOrigin: false } } }, build: { lib: { entry, formats: ['es'], fileName: (_format, entryName) => `${entryName}.js` }, outDir: resolve(ROOT, 'public/typed-build'), emptyOutDir: true, sourcemap: true, target: 'es2022', rollupOptions: { output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js', assetFileNames: '[name]-[hash][extname]' } } } });
