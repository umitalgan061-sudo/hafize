import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('../', import.meta.url).pathname);
const read = (path) => readFile(resolve(root, path), 'utf8');
const sources = {};
for (const name of ['prompt-library-smart-insert','prompt-library-smart-insert-center','prompt-library-smart-insert-history','prompt-library-smart-insert-presets']) sources[name] = await read('public/typed/legacy/' + name + '.ts');

assert.match(sources['prompt-library-smart-insert'], /hafize\\.prompt-library\\.variable-profiles\\.v1/);
assert.match(sources['prompt-library-smart-insert-center'], /hafize\\.prompt-library\\.variable-profiles\\.v1/);
assert.match(sources['prompt-library-smart-insert-center'], /center-state/);
assert.match(sources['prompt-library-smart-insert-history'], /hafize\\.prompt-library\\.smart-insert-history\\.v1/);
assert.match(sources['prompt-library-smart-insert-presets'], /hafize\\.prompt-library\\.variable-presets\\.v1/);

const source = Object.values(sources).join('\\n');
assert.match(source, /24/);
assert.match(source, /1000/);
assert.doesNotMatch(source, /localStorage\\.clear\\s*\\(/);
assert.doesNotMatch(source, /sessionStorage\\.clear\\s*\\(/);
assert.doesNotMatch(source, /removeItem\\([^)]*variable-profiles/);
assert.doesNotMatch(source, /removeItem\\([^)]*smart-insert-history/);
assert.doesNotMatch(source, /removeItem\\([^)]*variable-presets/);

const docs = await read('docs/TYPESCRIPT_SMART_INSERT_MIGRATION.md');
assert.match(docs, /storage anahtar/);
assert.match(docs, /veri migration/i);
console.log('Smart Insert storage compatibility: OK');
