import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/github-branch-create.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');

for (const forbidden of [
  /localStorage/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /innerHTML/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /Authorization\s*:/,
  /GITHUB_TOKEN/,
  /HAFIZE_GITHUB_WRITE_AUTH_TOKEN/,
  /HAFIZE_GITHUB_WRITE_APPROVAL_SECRET/,
  /ownerId/,
  /traceId/,
  /shell=True/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `forbidden branch-create surface: ${forbidden}`);
}

assert.equal(source.includes("const REPOSITORY = 'umitalgan061-sudo/hafize'"), true);
assert.equal(source.includes("operation: 'branch.create'"), true);
assert.equal(source.includes("const BRANCH_PREFIX = 'hafize/'"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes("body: JSON.stringify(body)"), true);
assert.equal(source.includes("postJson(PREPARE_PATH, { command })"), true);
assert.equal(source.includes("postJson(EXECUTE_PATH, { command: snapshot.command, approvalToken: snapshot.approvalToken })"), true);
assert.equal(source.includes("approveButton.addEventListener?.('click', execute)"), true);
assert.equal(source.includes("form.addEventListener?.('submit', prepare)"), true);
assert.equal(source.includes("if (!sameCommand(prepared.command, live))"), true);
assert.equal(source.includes("if (Date.parse(prepared.expiresAt) <= now())"), true);
assert.equal(source.includes("clearPrepared({ announce: true })"), true);
assert.equal(source.includes("new rootRef.MutationObserver"), true);
assert.equal(source.includes('MOUNT_TIMEOUT_MS = 10_000'), true);

for (const forbiddenOperation of ["'file.update'", "'pr.create'", "'pr.merge'"]) {
  assert.equal(source.includes(`operation: ${forbiddenOperation}`), false, `UI must not construct ${forbiddenOperation}`);
}

assert.equal((source.match(/\/api\/github\/write\/prepare/g) || []).length, 1);
assert.equal((source.match(/\/api\/github\/write\/execute/g) || []).length, 1);

console.log('github branch create boundary tests passed');
