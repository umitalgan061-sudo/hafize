import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path: string): Promise<string> => readFile(new URL(path, root), 'utf8');

const packageData = JSON.parse(await read('package.json')) as {
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};
const vite = await read('vite.config.ts');
const html = await read('public/index.html');
const sw = await read('public/sw-policy.ts');

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`typescript-ui-wave: ${message}`);
}

const expectedVersions = {
  typescript: '7.0.2',
  vite: '8.3.0',
  vitest: '5.0.1'
};

for (const [name, version] of Object.entries(expectedVersions)) {
  check(packageData.devDependencies?.[name] === version, `${name} pinned to ${version}`);
}

check(packageData.scripts?.build === 'tsc --noEmit && vite build', 'build typechecks before bundling');
check(packageData.scripts?.typecheck === 'npm run typecheck:runtime', 'typecheck uses runtime project');
check(packageData.scripts?.['check:modern']?.includes('test-typescript-entrypoints-release.ts'), 'release gate is wired');
check(packageData.scripts?.['check:modern']?.includes('test-typescript-ui-wave.ts'), 'ui wave gate is wired');

for (const entry of [
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
  'scheduled-tasks',
  'workspace-backup',
  'generation-control'
]) {
  if (entry === 'generation-control') {
    check(vite.includes('generation-control.ts'), 'generation control import source');
    check(html.includes('/generation-control.css'), 'generation control stylesheet');
    check(sw.includes('/generation-control.css'), 'generation control pwa asset');
    continue;
  }
  check(html.includes(`<script type="module" src="/typed-build/${entry}.js"></script>`) || vite.includes(`'legacy-app':`), `module entry: ${entry}`);
  check(sw.includes(`/typed-build/${entry}.js`) || entry === 'workspace-backup', `pwa entry: ${entry}`);
}

check(sw.includes('v55'), 'current pwa cache version');
check(!html.includes('src="/app.js"'), 'legacy app.js direct entry removed');
check(!html.includes('src="/auth.js"'), 'legacy auth.js direct entry removed');
check(!html.includes('src="/prompt-library.js"'), 'legacy prompt-library.js direct entry removed');

console.log('TypeScript UI migration wave gate: OK');
