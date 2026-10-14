import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const sources = [
  read('lib/github-workspace.ts'),
  read('lib/github-workspace-extra.ts'),
  read('lib/github-workspace-details.ts')
];

for (const source of sources) {
  assert.match(source, /MAX_REPOSITORY = 120/);
  assert.match(source, /MAX_REF = 200/);
}
// Only the surfaces that take a file path clamp one.
for (const source of [sources[0], sources[1]]) assert.match(source, /MAX_PATH = 400/);
assert.match(sources[1], /MAX_LIMIT = 30/);
assert.match(sources[2], /MAX_BODY = 2400/);
console.log('github-workspace-bounds: ok');
