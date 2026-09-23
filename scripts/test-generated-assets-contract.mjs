import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');

const entries = [
  'app-runtime',
  'prompt-library-smart-fill',
  'prompt-library-command-palette',
  'scheduled-tasks-countdown',
  'prompt-library-smart-fill-hints'
];

function assert(condition, message) {
  if (!condition) throw new Error(`generated-assets-contract: ${message}`);
}

for (const entry of entries) {
  assert(html.includes(`/typed-build/${entry}.js`), `${entry} missing from HTML`);
  assert(sw.includes(`/typed-build/${entry}.js`), `${entry} missing from PWA cache`);
  assert(vite.includes(`'${entry}':`), `${entry} missing from Vite entry map`);
}

// The shell cache version is bumped on every shell change (docs/CHECK_GATE.md),
// so the contract is that it stays versioned, not that it stays at one number.
assert(/CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/.test(sw), 'shell cache must declare a numeric version');
assert(!html.includes('typed-build/*.js'), 'wildcard generated entry is not allowed');
assert(!html.includes('/public/typed'), 'source filesystem path must not appear in HTML');
console.log(`generated-assets-contract: ${entries.length} typed entries aligned`);
