import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const typedDevEntryPlugin = (): Plugin => ({
  name: 'hafize-typed-dev-entries',
  transformIndexHtml(html, context) {
    if (!context.server) return html;
    return html
      .replaceAll('/typed-build/auth.js', '/typed/auth.ts')
      .replaceAll('/typed-build/app-shell.js', '/typed/app-shell.ts')
      .replaceAll('/typed-build/ui-shell.js', '/typed/ui-shell.ts')
      .replaceAll('/typed-build/voice-input.js', '/typed/voice-input.ts')
      .replaceAll('/typed-build/markdown-renderer.js', '/typed/markdown-renderer.ts')
      .replaceAll('/typed-build/conversation-workspace.js', '/typed/conversation-workspace.ts')
      .replaceAll('/typed-build/conversation-forks.js', '/typed/conversation-forks.ts')
      .replaceAll('/typed-build/message-workspace.js', '/typed/message-workspace.ts')
      .replaceAll('/typed-build/prompt-library.js', '/typed/prompt-library.ts')
      .replaceAll('/typed-build/scheduled-tasks.js', '/typed/scheduled-tasks.ts')
      .replaceAll('/typed-build/voice-output.js', '/typed/voice-output.ts')
      .replaceAll('/typed-build/app-runtime.js', '/typed/app-runtime.ts')
      .replaceAll('/typed-build/prompt-library-smart-fill.js', '/prompt-library-smart-fill.ts')
      .replaceAll('/typed-build/prompt-library-command-palette.js', '/prompt-library-command-palette.ts')
      .replaceAll('/typed-build/scheduled-tasks-countdown.js', '/scheduled-tasks-countdown.ts')
      .replaceAll('/typed-build/prompt-library-smart-fill-hints.js', '/prompt-library-smart-fill-hints.ts')
      .replaceAll('/typed-build/github-workspace.js', '/github-workspace.ts')
      .replaceAll('/typed-build/github-workspace-extra.js', '/github-workspace-extra.ts')
      .replaceAll('/typed-build/github-workspace-actions.js', '/github-workspace-actions.ts')
      .replaceAll('/typed-build/github-workspace-details.js', '/github-workspace-details.ts')
      .replaceAll('/typed-build/github-workspace-write.js', '/github-workspace-write.ts')
      .replaceAll('/typed-build/workspace-backup.js', '/typed/workspace-backup.ts')
      .replaceAll('/typed-build/system-readiness-panel.js', '/system-readiness-panel.ts')
      .replaceAll('/typed-build/chat-composer-features.js', '/typed/chat-composer-features.ts')
      .replaceAll('/typed-build/chat-history-search.js', '/typed/chat-history-search.ts')
      .replaceAll('/typed-build/chat-history-management.js', '/typed/chat-history-management.ts')
      .replaceAll('/typed-build/hands-free-background-guard.js', '/typed/hands-free-background-guard.ts')
      .replaceAll('/typed-build/workspace-navigation.js', '/typed/workspace-navigation.ts');
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
        'auth': resolve(ROOT, 'public/typed/auth.ts'),
        'app-shell': resolve(ROOT, 'public/typed/app-shell.ts'),
        'ui-shell': resolve(ROOT, 'public/typed/ui-shell.ts'),
        'voice-input': resolve(ROOT, 'public/typed/voice-input.ts'),
        'voice-output': resolve(ROOT, 'public/typed/voice-output.ts'),
        'app-runtime': resolve(ROOT, 'public/typed/app-runtime.ts'),
        'prompt-library-smart-fill': resolve(ROOT, 'public/prompt-library-smart-fill.ts'),
        'prompt-library-command-palette': resolve(ROOT, 'public/prompt-library-command-palette.ts'),
        'scheduled-tasks-countdown': resolve(ROOT, 'public/scheduled-tasks-countdown.ts'),
        'prompt-library-smart-fill-hints': resolve(ROOT, 'public/prompt-library-smart-fill-hints.ts'),
        'conversation-forks': resolve(ROOT, 'public/typed/conversation-forks.ts'),
        'github-workspace': resolve(ROOT, 'public/github-workspace.ts'),
        'github-workspace-extra': resolve(ROOT, 'public/github-workspace-extra.ts'),
        'github-workspace-actions': resolve(ROOT, 'public/github-workspace-actions.ts'),
        'github-workspace-details': resolve(ROOT, 'public/github-workspace-details.ts'),
        'github-workspace-write': resolve(ROOT, 'public/github-workspace-write.ts'),
        'workspace-backup': resolve(ROOT, 'public/typed/workspace-backup.ts'),
        'system-readiness-panel': resolve(ROOT, 'public/system-readiness-panel.ts'),
        'chat-composer-features': resolve(ROOT, 'public/typed/chat-composer-features.ts'),
        'chat-history-search': resolve(ROOT, 'public/typed/chat-history-search.ts'),
        'chat-history-management': resolve(ROOT, 'public/typed/chat-history-management.ts'),
        'hands-free-background-guard': resolve(ROOT, 'public/typed/hands-free-background-guard.ts'),
        'workspace-navigation': resolve(ROOT, 'public/typed/workspace-navigation.ts'),
        'markdown-renderer': resolve(ROOT, 'public/markdown-renderer.ts'),
        'conversation-workspace': resolve(ROOT, 'public/conversation-workspace.ts'),
        'message-workspace': resolve(ROOT, 'public/typed/message-workspace.ts'),
        'prompt-library': resolve(ROOT, 'public/typed/prompt-library.ts'),
        'scheduled-tasks': resolve(ROOT, 'public/typed/scheduled-tasks.ts')
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
