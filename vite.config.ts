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
        .replaceAll('/typed-build/app.js', '/app.ts')
        .replaceAll('/typed-build/auth.js', '/auth.ts')
        .replaceAll('/typed-build/chat-composer-features.js', '/chat-composer-features.ts')
        .replaceAll('/typed-build/conversation-workspace.js', '/conversation-workspace.ts')
        .replaceAll('/typed-build/conversation-workspace-keyboard.js', '/conversation-workspace-keyboard.ts')
        .replaceAll('/typed-build/message-workspace-policy.js', '/message-workspace-policy.ts')
        .replaceAll('/typed-build/message-workspace.js', '/message-workspace.ts')
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
        'app': resolve(ROOT, 'public/app.ts'),
        'auth': resolve(ROOT, 'public/auth.ts'),
        'chat-composer-features': resolve(ROOT, 'public/chat-composer-features.ts'),
        'conversation-workspace': resolve(ROOT, 'public/conversation-workspace.ts'),
        'conversation-workspace-keyboard': resolve(ROOT, 'public/conversation-workspace-keyboard.ts'),
        'message-workspace-policy': resolve(ROOT, 'public/message-workspace-policy.ts'),
        'message-workspace': resolve(ROOT, 'public/message-workspace.ts'),
        'workspace-navigation': resolve(ROOT, 'public/workspace-navigation.ts'),

        'prompt-library-smart-fill': resolve(ROOT, 'public/prompt-library-smart-fill.ts'),
        'prompt-library-command-palette': resolve(ROOT, 'public/prompt-library-command-palette.ts'),
        'scheduled-tasks-countdown': resolve(ROOT, 'public/scheduled-tasks-countdown.ts'),
        'prompt-library-smart-fill-hints': resolve(ROOT, 'public/prompt-library-smart-fill-hints.ts')
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
