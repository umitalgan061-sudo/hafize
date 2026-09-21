import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'lib/production-guard.ts'), 'utf8');
const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

for (const route of ['/api/github/workspace/commit', '/api/github/workspace/pull']) {
  assert.match(server, new RegExp(route.replace(/[/.]/g, '\\$&')));
  assert.match(guard, new RegExp(route.replace(/[/.]/g, '\\$&')));
}
assert.match(vite, /github-workspace-details/);
assert.match(index, /typed-build\/github-workspace-details\.js/);
console.log('github-workspace-details-routing: ok');
