import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, 'lib/github-workspace.ts'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');

for (const action of ['repo', 'branches', 'commits', 'pulls', 'file']) assert.match(source, new RegExp(`'${action}'`));
assert.match(source, /per_page/);
assert.match(source, /X-GitHub-Api-Version/);
assert.match(source, /GITHUB_REPO_NOT_ALLOWED/);
assert.match(server, /\/api\/github\/workspace/);
console.log('github-workspace-api: ok');
