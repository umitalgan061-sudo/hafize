import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'ui-shell.js' });
const api = sandbox.module.exports;

const appended = [];
const ids = new Map();
const head = {
  append(node) {
    appended.push(node);
    if (node.id) ids.set(node.id, node);
  }
};
const documentRef = {
  head,
  createElement(tag) {
    assert.equal(tag, 'script');
    return { id: '', src: '', async: true };
  },
  getElementById(id) { return ids.get(id) || null; },
  querySelector(selector) { return selector === 'head' ? head : null; }
};

assert.equal(api.installConversationBranchAssets(documentRef), api.CONVERSATION_BRANCH_ASSETS.length);
assert.deepEqual(
  appended.map((node) => node.src),
  Array.from(api.CONVERSATION_BRANCH_ASSETS, (asset) => asset.src)
);
assert.ok(appended.every((node) => node.async === false), 'dynamic scripts must keep deterministic order');
assert.ok(appended.every((node) => /^\/[a-z0-9-]+\.js$/i.test(node.src)), 'only fixed same-origin script paths are allowed');
assert.equal(new Set(appended.map((node) => node.id)).size, appended.length);

const countAfterFirstInstall = appended.length;
assert.equal(api.installConversationBranchAssets(documentRef), 0, 'second install must be idempotent');
assert.equal(appended.length, countAfterFirstInstall);

assert.equal(api.appendFixedScript(documentRef, '', '/x.js'), false);
assert.equal(api.appendFixedScript(documentRef, 'x', ''), false);
assert.equal(api.installConversationBranchAssets(null), 0);

const expected = [
  '/message-copy.js',
  '/conversation-model-state.js',
  '/conversation-branch-lineage.js',
  '/conversation-fork.js',
  '/message-edit.js',
  '/response-retry-style.js',
  '/response-retry.js'
];
assert.deepEqual(Array.from(api.CONVERSATION_BRANCH_ASSETS, (asset) => asset.src), expected);

console.log('ui-shell conversation branch loader: ok');
