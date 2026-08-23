import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files = await Promise.all([
  'conversation-branch-lineage.js',
  'conversation-fork.js',
  'message-edit.js'
].map((name) => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8')));
const [lineageSource, forkSource, editSource] = files;

const sandbox = { module: { exports: {} }, exports: {}, globalThis: {} };
vm.runInNewContext(lineageSource, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

for (const forbidden of [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /document\.cookie/,
  /sessionStorage/,
  /indexedDB/i,
  /clipboard/i,
  /innerHTML/,
  /insertAdjacentHTML/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.doesNotMatch(lineageSource, forbidden);
}

const validIds = new Set(['parent', 'child']);
const injected = api.normalizeEntry({
  childConversationId: 'child',
  parentConversationId: 'parent',
  sourceMessageId: 'msg-1',
  mode: 'edit',
  createdAt: '2026-08-19T00:00:00.000Z',
  content: 'private transcript',
  title: 'private title',
  ownerId: 'owner-secret',
  traceId: 'trace-secret',
  accessToken: 'token-secret',
  credential: 'credential-secret',
  __proto__: { polluted: true }
}, validIds);
assert.ok(injected);
assert.deepEqual(Object.keys(injected).sort(), [
  'childConversationId', 'createdAt', 'mode', 'parentConversationId', 'sourceMessageId'
].sort());
assert.equal(injected.content, undefined);
assert.equal(injected.ownerId, undefined);
assert.equal(injected.polluted, undefined);

const duplicate = api.normalizeEntries([
  { ...injected, sourceMessageId: 'latest' },
  { ...injected, sourceMessageId: 'older' }
], validIds);
assert.equal(duplicate.length, 1);
assert.equal(duplicate[0].sourceMessageId, 'latest');

assert.equal(api.normalizeEntry({
  ...injected,
  childConversationId: 'child\nforged'
}, new Set(['parent', 'child\nforged'])), null);
assert.equal(api.normalizeEntry({
  ...injected,
  parentConversationId: '../parent'
}, new Set(['../parent', 'child'])), null);

for (const [source, mode] of [[forkSource, 'fork'], [editSource, 'edit']]) {
  const persistAt = source.indexOf('storage.setItem(STORAGE_KEY');
  const verifyAt = source.indexOf(mode === 'fork' ? "throw new Error('FORK_SOURCE_NOT_PERSISTED')" : "throw new Error('EDIT_BRANCH_SOURCE_NOT_PERSISTED')");
  const publishAt = source.indexOf('publishLineage({');
  assert.ok(persistAt >= 0 && verifyAt > persistAt && publishAt > verifyAt, `${mode} lineage must publish only after canonical persistence verification`);
  const detail = source.slice(publishAt, source.indexOf('});', publishAt) + 3);
  assert.match(detail, /childConversationId:/);
  assert.match(detail, /parentConversationId:/);
  assert.match(detail, /sourceMessageId:/);
  assert.match(detail, new RegExp(`mode: '${mode}'`));
  assert.doesNotMatch(detail, /content|title|ownerId|traceId|token|credential/i);
}

assert.match(lineageSource, /textContent =/);
assert.doesNotMatch(lineageSource, /\.innerHTML\s*=/);
assert.match(lineageSource, /MAX_ENTRIES = 60/);
assert.match(lineageSource, /childConversationId === parentConversationId/);
assert.match(lineageSource, /conversationExists\(validConversations, childConversationId\)/);
assert.match(lineageSource, /conversationExists\(validConversations, parentConversationId\)/);

console.log('conversation branch lineage security contract: ok');