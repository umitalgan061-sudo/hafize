import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const activity = require('../public/github-write-activity.js');

const secretPayload = {
  branch: 'hafize/security-test',
  path: 'public/app.js',
  approvalToken: 'gw1.secret.signature',
  authorization: 'Bearer secret',
  cookie: 'hafize_session=secret',
  ownerId: 'private-owner',
  traceId: 'private-trace',
  blobSha: 'a'.repeat(40),
  commitSha: 'b'.repeat(40),
  content: '<script>steal()</script>',
  commitMessage: 'secret commit message',
  nested: { token: 'nested-secret' }
};

const safe = activity.normalizeEvent('hafize:github-file-updated', secretPayload, 1234);
assert.deepEqual(safe, {
  kind: 'file',
  branch: 'hafize/security-test',
  path: 'public/app.js',
  at: 1234
});

const serialized = JSON.stringify(safe);
for (const forbidden of [
  'gw1.secret.signature',
  'Bearer secret',
  'hafize_session',
  'private-owner',
  'private-trace',
  '<script>',
  'secret commit message',
  'nested-secret',
  'aaaaaaaaaaaa',
  'bbbbbbbbbbbb'
]) {
  assert.equal(serialized.includes(forbidden), false, `normalized event leaked: ${forbidden}`);
}

for (const branch of [
  'main',
  'hafize/',
  'hafize/../main',
  'hafize/a//b',
  'hafize/a b',
  'hafize/💥',
  `hafize/${'x'.repeat(121)}`
]) {
  assert.equal(activity.normalizeEvent('hafize:github-branch-created', { branch }, 1), null, `unsafe branch accepted: ${branch}`);
}

for (const path of [
  '/etc/passwd',
  '../secret',
  'public/../secret',
  'public//app.js',
  'public/app.js/',
  'public/a b.js',
  'public/💥.js',
  'x'.repeat(401)
]) {
  assert.equal(activity.normalizeEvent('hafize:github-file-updated', {
    branch: 'hafize/security-test',
    path
  }, 1), null, `unsafe path accepted: ${path}`);
}

const original = activity.normalizeEvent('hafize:github-draft-pr-created', { prNumber: 77 }, 10);
const updated = activity.normalizeEvent('hafize:github-draft-pr-created', { prNumber: 77 }, 20);
const deduped = activity.appendItem([original], updated);
assert.equal(deduped.length, 1);
assert.equal(deduped[0].at, 20);
assert.equal(Object.isFrozen(deduped[0]), true);

console.log('github write activity adversarial tests passed');
