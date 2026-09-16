import { access, readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

async function exists(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`legacy-entry-contract: ${message}`);
}

const migrated = [
  'prompt-library-smart-fill',
  'prompt-library-command-palette',
  'scheduled-tasks-countdown'
];

for (const name of migrated) {
  assert(!html.includes(`/${name}.js\" defer`), `${name}.js is still loaded directly`);
  assert(html.includes(`/typed-build/${name}.js`), `${name} generated entry is missing`);
  assert(await exists(`public/${name}.ts`), `${name}.ts source is missing`);
}

assert(await exists('public/typed/hafize-api.ts'), 'typed API boundary missing');
assert(await exists('public/typed/hafize-types.ts'), 'typed domain contracts missing');
assert(await exists('public/typed/app-runtime.ts'), 'typed runtime surface missing');
assert(html.includes('/hafize-runtime.css'), 'runtime diagnostics stylesheet missing');

const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
for (const name of migrated) assert(sw.includes(`/typed-build/${name}.js`), `${name} generated entry is not in PWA shell`);
assert(sw.includes('/typed-build/app-runtime.js'), 'app runtime generated entry is not in PWA shell');
assert(sw.includes('hafize-shell-v34'), 'PWA cache was not versioned for the new entries');

console.log(`legacy-entry-contract: ${migrated.length} migrated modules protected`);
