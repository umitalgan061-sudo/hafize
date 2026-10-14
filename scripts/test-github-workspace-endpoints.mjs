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
// The read surface stays GET-only. Writes exist, but only behind the explicit
// approval ticket and write routes of the approved-write workspace.
assert.match(server, /req\.method === 'GET' && url\.pathname === '\/api\/github\/workspace'/);
assert.doesNotMatch(server, /'POST'[^\n]*url\.pathname === '\/api\/github\/workspace'[^/]/);
assert.match(
  server,
  /req\.method === 'POST' && \(url\.pathname === '\/api\/github\/workspace\/write\/approval' \|\| url\.pathname === '\/api\/github\/workspace\/write'\)/
);
console.log('github-workspace-endpoints: ok');
