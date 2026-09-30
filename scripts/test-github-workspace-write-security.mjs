import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const writer=fs.readFileSync(path.join(root,'lib/github-workspace-write.ts'),'utf8');
const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');
const guard=fs.readFileSync(path.join(root,'lib/production-guard.ts'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');

assert.match(writer,/HAFIZE_GITHUB_WRITE_REPOS|allowedRepositories/);
assert.match(writer,/GITHUB_DEFAULT_BRANCH_BLOCKED/);
assert.match(writer,/GITHUB_SENSITIVE_PATH_BLOCKED/);
assert.match(writer,/GITHUB_WORKFLOW_PATH_BLOCKED/);
assert.match(writer,/GITHUB_CONTENT_CREDENTIAL_BLOCKED/);
assert.match(writer,/timingSafeEqual/);
assert.match(writer,/MAX_APPROVALS/);
assert.match(writer,/APPROVAL_TTL_MS/);
assert.match(server,/HAFIZE_GITHUB_WRITE_REPOS/);
assert.match(server,/workspace\/write\/approval/);
assert.match(server,/workspace\/write/);
assert.match(guard,/workspace\/write\/approval/);
assert.match(guard,/workspace\/write/);
assert.doesNotMatch(ui,/GITHUB_TOKEN/);
assert.doesNotMatch(ui,/Authorization:/);
assert.match(ui,/credentials:\s*['"]same-origin['"]/);
assert.match(ui,/approval/);
console.log('github-workspace-write-security: ok');
