import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const core = fs.readFileSync(path.join(root, 'lib/github-workspace-extra.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'public/github-workspace-extra.ts'), 'utf8');

for (const token of ['directory', 'compare', 'MAX_LIMIT', 'allowedRepositories']) assert.match(core, new RegExp(token));
assert.match(core, /method: 'GET'/);
assert.doesNotMatch(core, /method: ['"]POST['"]/);
assert.match(core, /ahead_by/);
assert.match(core, /deletions/);
assert.match(ui, /workspace\/directory/);
assert.match(ui, /workspace\/compare/);
assert.match(ui, /credentials: ['"]same-origin['"]/);
assert.match(ui, /noopener noreferrer/);
console.log('github-workspace-extra: ok');
