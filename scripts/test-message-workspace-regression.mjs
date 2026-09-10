import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const app = await read('public/app.js');
const workspace = await read('public/message-workspace.js');
const index = await read('public/index.html');
const sw = await read('public/sw-policy.js');

assert.ok(app.includes("hafize.conversations.v1"));
assert.ok(app.includes('function saveConversations()'));
assert.ok(app.includes('function renderMessages()'));
assert.ok(app.includes('data-message-id'));
assert.ok(app.includes('message.role'));

assert.ok(workspace.includes("hafize.message-workspace.v1"));
assert.ok(!workspace.includes("hafize.conversations.v1"));
assert.ok(workspace.includes('currentConversationId()'));
assert.ok(workspace.includes('messageId'));
assert.ok(workspace.includes('conversationId'));

assert.ok(index.includes('id="messages"'));
assert.ok(index.includes('class="utility-rail"'));
assert.ok(index.indexOf('/message-workspace.js') > index.indexOf('/app.js'));
assert.ok(index.indexOf('/message-workspace-policy.js') < index.indexOf('/message-workspace.js'));

assert.ok(sw.indexOf("'/message-workspace-policy.js'") < sw.indexOf("'/message-workspace.js'"));
assert.ok(sw.includes("'/message-workspace.css'"));

for (const token of [
  'Authorization:',
  'credentials:',
  'navigator.mediaDevices',
  'document.cookie',
  'sessionStorage',
  'chrome.runtime',
  'electron'
]) {
  assert.equal(workspace.includes(token), false, `unexpected cross-boundary token: ${token}`);
}

const storageKeys = [...workspace.matchAll(/localStorage\.(?:getItem|setItem)\(([^)]+)/g)].map(match => match[1]);
assert.ok(storageKeys.length >= 2);
for (const expression of storageKeys) {
  assert.equal(expression.includes('hafize.conversations.v1'), false);
}

assert.ok(workspace.includes('window.setInterval(sweepMissingRecords, 12000)'));
assert.ok(workspace.includes('MutationObserver'));
assert.ok(workspace.includes('storage'));
assert.ok(workspace.includes('CustomEvent'));

assert.ok(!app.includes('message-workspace')); // integration must stay decoupled from runtime storage

console.log('message workspace regression tests passed');
