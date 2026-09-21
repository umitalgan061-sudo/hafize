import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw-policy.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(index, /github-workspace\.css/);
assert.match(index, /github-workspace/);
assert.match(vite, /github-workspace/);
assert.match(sw, /github-workspace/);
assert.match(readme, /GitHub çalışma alanı/);
console.log('github-workspace-contract: ok');
