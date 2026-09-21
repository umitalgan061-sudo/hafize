import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const core = fs.readFileSync(path.join(root, 'lib/github-workspace-details.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'public/github-workspace-details.ts'), 'utf8');

assert.match(core, /async function commit/);
assert.match(core, /async function pull/);
assert.match(core, /MAX_BODY = 2400/);
assert.match(core, /MAX_FILES = 30/);
assert.match(core, /method: 'GET'/);
assert.doesNotMatch(core, /method: ['"](POST|PUT|PATCH|DELETE)['"]/);
assert.match(ui, /Commit SHA/);
assert.match(ui, /PR numarası/);
assert.match(ui, /workspace\/commit/);
assert.match(ui, /workspace\/pull/);
assert.match(ui, /noopener noreferrer/);
console.log('github-workspace-details: ok');
