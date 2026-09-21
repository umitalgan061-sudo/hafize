import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const docs = ['ARCHITECTURE', 'SECURITY', 'API', 'USER_GUIDE', 'TEST_MATRIX', 'OPERATIONS'].map((name) => path.join(root, 'docs', 'GITHUB_WORKSPACE_' + name + '.md'));
assert.match(readme, /GitHub çalışma alanı/);
docs.forEach((file) => assert.ok(fs.existsSync(file), 'missing ' + path.basename(file)));
console.log('github-workspace-docs: ok');
