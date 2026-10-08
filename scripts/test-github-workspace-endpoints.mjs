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
// The approved write workspace added two POST routes, so the invariant is no
// longer "no POST at all": every read route stays GET-only, and POST reaches
// nothing but the explicitly approved write endpoints.
for (const route of [
  '/api/github/workspace',
  '/api/github/workspace/directory',
  '/api/github/workspace/compare',
  '/api/github/workspace/commit',
  '/api/github/workspace/pull'
]) {
  assert.ok(
    server.includes(`req.method === 'GET' && url.pathname === '${route}'`)
      || server.includes(`url.pathname === '${route}'`) && server.includes("req.method === 'GET'"),
    `${route} is served only for GET`
  );
}
const postRoutes = [...server.matchAll(/req\.method === 'POST' && \(?([^)]*github\/workspace[^)]*)\)?\s*\)/g)]
  .flatMap((match) => [...match[1].matchAll(/'(\/api\/github\/workspace[^']*)'/g)].map((inner) => inner[1]));
assert.deepEqual(
  [...new Set(postRoutes)].sort(),
  ['/api/github/workspace/write', '/api/github/workspace/write/approval'],
  'only the approved write endpoints accept POST'
);
console.log('github-workspace-endpoints: ok');
