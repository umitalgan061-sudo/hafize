import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const core = read('lib/github-workspace.ts');
const extra = read('lib/github-workspace-extra.ts');
const details = read('lib/github-workspace-details.ts');

// Repository ve ref sınırları üç okuyucuda da ortaktır.
for (const source of [core, extra, details]) {
  assert.match(source, /MAX_REPOSITORY = 120/);
  assert.match(source, /MAX_REF = 200/);
}
// Yol ve liste sınırları yalnızca dosya/dizin okuyan yüzeylerde bulunur.
for (const source of [core, extra]) {
  assert.match(source, /MAX_PATH = 400/);
  assert.match(source, /MAX_LIMIT = 30/);
}
// Detay okuyucu commit/PR gövdesini sınırlar.
assert.match(details, /MAX_BODY = 2400/);
console.log('github-workspace-bounds: ok');
