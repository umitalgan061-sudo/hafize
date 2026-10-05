import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const vite = read('vite.config.ts');
const html = read('public/index.html');
const sw = read('public/sw-policy.ts');
const runtime = read('tsconfig.runtime.json');

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(`typescript-entrypoints-release: ${message}`);
};

assert(pkg.scripts?.start === 'node --import ./lib/production-guard.ts server.ts', 'production start must be typed');
assert(pkg.scripts?.['dev:server'] === 'node --import ./lib/production-guard.ts server.ts', 'development server must be typed');
assert(/server\.ts/.test(runtime), 'runtime tsconfig must target server.ts');

const entries = [
  'auth',
  'app-shell',
  'ui-shell',
  'voice-input',
  'voice-output',
  'markdown-renderer',
  'conversation-workspace',
  'conversation-forks',
  'message-workspace',
  'prompt-library',
  'prompt-library-smart-fill',
  'prompt-library-command-palette',
  'scheduled-tasks',
  'scheduled-tasks-countdown',
  'prompt-library-smart-fill-hints',
  'workspace-backup',
  'system-readiness-panel',
  'legacy-app'
];

for (const entry of entries) {
  assert(vite.includes(`typed/${entry}.ts`) || vite.includes(`public/${entry}.ts`), `vite source entry missing: ${entry}`);
  assert(html.includes(`/typed-build/${entry}.js`), `html generated entry missing: ${entry}`);
  assert(sw.includes(`/typed-build/${entry}.js`), `pwa generated entry missing: ${entry}`);
}

for (const legacy of [
  'public/app.js',
  'public/auth.js',
  'public/ui-shell.js',
  'public/voice-input.js',
  'public/voice-output.js',
  'public/chat-markdown.js',
  'public/conversation-workspace.js',
  'public/markdown-renderer.js',
  'public/message-workspace.js',
  'public/prompt-library.js',
  'public/scheduled-tasks.js'
]) {
  assert(!existsSync(join(root, legacy)), `legacy browser source still exists: ${legacy}`);
}

assert(!existsSync(join(root, 'server.mjs')), 'legacy server entry still exists');
assert(existsSync(join(root, 'server.ts')), 'server.ts missing');
assert(existsSync(join(root, 'public/typed/app-shell.ts')), 'typed app shell missing');
assert(existsSync(join(root, 'public/typed/generation-control.ts')), 'generation control missing');
assert(existsSync(join(root, 'public/typed/generation-history.ts')), 'generation history missing');
assert(html.includes('/generation-control.css'), 'generation control stylesheet missing');
assert(sw.includes('/generation-control.css'), 'generation control stylesheet missing from pwa shell');

console.log('TypeScript entrypoint release gate: OK');
