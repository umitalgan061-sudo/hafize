import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const packageData = JSON.parse(await read('package.json'));
const vite = await read('vite.config.ts');
const html = await read('public/index.html');
const sw = await read('public/sw-policy.js');

function check(condition, message) {
  assert.ok(condition, `typescript-ui-wave: ${message}`);
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
check(packageData.scripts?.typecheck === 'tsc --noEmit', 'typecheck script present');
check(packageData.scripts?.['typecheck:runtime'] === 'tsc --noEmit -p tsconfig.runtime.json', 'runtime typecheck present');
check(packageData.scripts?.['check:modern']?.includes('test-typescript-ui-wave.mjs'), 'UI wave gate is wired');

for (const entry of ['markdown-renderer', 'conversation-workspace', 'message-workspace', 'prompt-library', 'scheduled-tasks']) {
  const sourcePath = ['markdown-renderer','conversation-workspace'].includes(entry) ? `public/${entry}.ts` : `public/typed/${entry}.ts`;
  const vitePath = ['markdown-renderer','conversation-workspace'].includes(entry) ? `public/${entry}.ts` : `public/typed/${entry}.ts`;
  check(vite.includes(`'${entry}': resolve(ROOT, '${vitePath}')`), `${entry} Vite entry`);
  check(vite.includes(`/typed-build/${entry}.js`), `${entry} dev transform`);
  check(html.includes(`<script type="module" src="/typed-build/${entry}.js"></script>`), `${entry} module script`);
  check(sw.includes(`/typed-build/${entry}.js`), `${entry} PWA shell asset`);
  check(!html.includes(`<script src="/${entry}.js" defer></script>`), `${entry} legacy direct script removed`);

  const typed = await read(sourcePath);
  check(typed.includes('// @ts-nocheck'), `${entry} migration status is explicit`);
  check(!typed.includes('Authorization:'), `${entry} does not embed auth headers`);
}

for (const legacy of ['markdown-renderer', 'conversation-workspace']) {
  const source = await read(`public/${legacy}.js`);
  check(source.length < 500, `${legacy} legacy file is only a compatibility bridge`);
  check(source.includes('import(\'/typed-build/'), `${legacy} bridge points to compiled TypeScript`);
  check(!source.includes('innerHTML'), `${legacy} bridge has no DOM implementation`);
  check(!source.includes('fetch('), `${legacy} bridge has no network implementation`);
}

// Asserting a literal version breaks on the next legitimate shell bump; the
// invariant is that the shell cache stays versioned at all.
check(/CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/.test(sw), 'PWA cache stays versioned');
check(!html.includes('/typed-build/markdown-renderer.js" defer'), 'module entry is not marked defer-only');
check(!html.includes('/typed-build/conversation-workspace.js" defer'), 'module entry is not marked defer-only');

console.log('TypeScript UI migration wave gate: OK');
