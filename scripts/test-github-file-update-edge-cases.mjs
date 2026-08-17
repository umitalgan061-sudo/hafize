import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-file-update.js');
const base = {
  branch: 'hafize/edge-file-update',
  path: 'public/example.txt',
  expectedBlobSha: 'a'.repeat(40),
  commitMessage: 'update edge fixture',
  content: 'safe\n'
};

// UTF-8 byte count, not JS code-unit count, governs the 64 KiB boundary.
assert.equal(api.utf8Bytes('ğ'), 2);
assert.equal(api.utf8Bytes('🙂'), 4);
const twoByteAtLimit = 'ğ'.repeat((64 * 1024) / 2);
assert.equal(api.utf8Bytes(twoByteAtLimit), 64 * 1024);
assert.equal(api.normalizeContent(twoByteAtLimit), twoByteAtLimit);
assert.equal(api.normalizeContent(`${twoByteAtLimit}ğ`), null);

for (const path of [
  '.ENV',
  'config/client_secret.json',
  'config/client-secret.json',
  'config/client.token.json',
  'keys/id_ed25519',
  'keys/id_rsa.pub.key',
  'keys/service.PFX',
  '.github/workflows/nested/check.yml',
  'a//b.js',
  'a/./b.js',
  'a/../b.js',
  'a\0b.js'
]) {
  assert.equal(api.normalizePath(path), null, `sensitive/invalid path must fail closed: ${path}`);
}

for (const path of ['public/tokenizer.js', 'docs/secretary-notes.md', 'public/private-view.js']) {
  assert.equal(api.normalizePath(path), path, `ordinary words must not become a deny-list false positive: ${path}`);
}

const command = api.buildCommand(base);
assert.ok(command);
const now = 1_800_000_000_000;
const token = `gw1.${'x'.repeat(16)}.${'y'.repeat(43)}`;
const validPrepared = { command, approvalToken: token, expiresAt: new Date(now + 60_000).toISOString() };
assert.ok(api.normalizePrepared(validPrepared, command, now));
assert.equal(api.normalizePrepared({ ...validPrepared, approvalToken: `${token}x` }, command, now), null);
assert.equal(api.normalizePrepared({ ...validPrepared, expiresAt: new Date(now + 6 * 60_000).toISOString() }, command, now), null);
assert.equal(api.normalizePrepared({ ...validPrepared, command: { ...command, expectedBlobSha: 'b'.repeat(40) } }, command, now), null);
assert.equal(api.normalizePrepared({ ...validPrepared, command: { ...command, commitMessage: 'different' } }, command, now), null);

const validReceipt = {
  receipt: {
    operation: 'file.update', repository: api.REPOSITORY, branch: command.branch, path: command.path,
    commitSha: 'b'.repeat(40), blobSha: 'c'.repeat(40)
  }
};
assert.ok(api.normalizeReceipt(validReceipt, command));
assert.equal(api.normalizeReceipt({ receipt: { ...validReceipt.receipt, repository: 'other/repo' } }, command), null);
assert.equal(api.normalizeReceipt({ receipt: { ...validReceipt.receipt, branch: 'hafize/other' } }, command), null);
assert.equal(api.normalizeReceipt({ receipt: { ...validReceipt.receipt, commitSha: 'b'.repeat(39) } }, command), null);
assert.equal(api.normalizeReceipt({ receipt: { ...validReceipt.receipt, blobSha: 'z'.repeat(40) } }, command), null);

console.log('github file update edge-case tests passed');
