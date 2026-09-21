import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const docs = fs.readdirSync(path.join(root, 'docs')).filter((name) => name.startsWith('GITHUB_WORKSPACE_'));
const scripts = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.startsWith('test-github-workspace-'));
assert.ok(docs.length >= 10, 'workspace docs set is unexpectedly small');
assert.ok(scripts.length >= 10, 'workspace test set is unexpectedly small');
console.log('github-workspace-maintenance: ok');
