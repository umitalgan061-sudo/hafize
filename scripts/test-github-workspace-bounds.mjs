import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const sources = [
  'lib/github-workspace.ts',
  'lib/github-workspace-extra.ts',
  'lib/github-workspace-details.ts'
].map((name) => fs.readFileSync(path.join(root, name), 'utf8'));

// Every module bounds the repository slug and the ref. `MAX_PATH` belongs to
// the two that accept a file path; the details module reads PR bodies and file
// lists instead, and bounds those.
for (const source of sources) {
  assert.match(source, /MAX_REPOSITORY = 120/);
  assert.match(source, /MAX_REF = 200/);
}
for (const source of [sources[0], sources[1]]) assert.match(source, /MAX_PATH = 400/);
assert.match(sources[1], /MAX_LIMIT = 30/);
assert.match(sources[2], /MAX_BODY = 2400/);
assert.match(sources[2], /MAX_FILES = 30/);
console.log('github-workspace-bounds: ok');
