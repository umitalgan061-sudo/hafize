import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'lib/production-guard.ts'), 'utf8');

for (const route of [
  '/api/github/workspace',
  '/api/github/workspace/directory',
  '/api/github/workspace/compare',
  '/api/github/workspace/commit',
  '/api/github/workspace/pull'
]) {
  assert.match(server, new RegExp(route.replace(/[/.]/g, '\\$&')));
  assert.match(guard, new RegExp(route.replace(/[/.]/g, '\\$&')));
}
const READ_ROUTES = [
  '/api/github/workspace',
  '/api/github/workspace/directory',
  '/api/github/workspace/compare',
  '/api/github/workspace/commit',
  '/api/github/workspace/pull'
];
for (const line of server.split('\n')) {
  if (!/req\.method === '(?:POST|PUT|PATCH|DELETE)'/.test(line)) continue;
  for (const route of READ_ROUTES) {
    assert.ok(
      !new RegExp(`pathname === '${route}'`).test(line),
      `${route} is read-only but a write method routes to it: ${line.trim()}`
    );
  }
}
// Every read route is reached through an explicit GET guard.
for (const route of READ_ROUTES) {
  assert.match(
    server,
    new RegExp(`req\\.method === 'GET' && [^\n]*pathname === '${route.replace(/[/.]/g, '\\$&')}'`),
    `${route} is served behind an explicit GET guard`
  );
}
// Writes exist, and only under the dedicated /write prefix.
assert.match(server, /req\.method === 'POST' && \(url\.pathname === '\/api\/github\/workspace\/write\/approval'/);
console.log('github-workspace-endpoints: ok');
