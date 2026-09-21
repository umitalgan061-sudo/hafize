import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'public/github-workspace-actions.ts'), 'utf8');
const details = fs.readFileSync(path.join(root, 'public/github-workspace-details.ts'), 'utf8');

assert.match(index, /github-workspace-details/);
assert.match(index, /github-workspace-actions/);
assert.match(actions, /cache: 'no-store'/);
assert.match(details, /cache: 'no-store'/);
assert.doesNotMatch(actions, /serviceWorker/);
assert.doesNotMatch(details, /serviceWorker/);
console.log('github-workspace-cache: ok');
