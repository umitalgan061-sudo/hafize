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
// The read surface stays GET-only. POST now reaches exactly two paths — the
// approved-write endpoint and its approval issuer — and nothing else under
// /api/github/workspace, so the read routes cannot be written through.
const postGithubRoutes = [...server.matchAll(/req\.method === 'POST' && \(?[^\n]*?(\/api\/github\/workspace[^'"]*)'/g)]
  .map((match) => match[1]);
assert.ok(postGithubRoutes.length > 0, 'the approved-write endpoint is served over POST');
const allowedPostRoutes = ['/api/github/workspace/write', '/api/github/workspace/write/approval'];
for (const route of postGithubRoutes) {
  assert.ok(allowedPostRoutes.includes(route), `unexpected POST route under the workspace: ${route}`);
}
for (const readRoute of [
  '/api/github/workspace',
  '/api/github/workspace/directory',
  '/api/github/workspace/compare',
  '/api/github/workspace/commit',
  '/api/github/workspace/pull'
]) {
  assert.equal(postGithubRoutes.includes(readRoute), false, `${readRoute} must stay read-only`);
}
console.log('github-workspace-endpoints: ok');
