import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const html = await read('public/index.html');
const app = await read('public/app.js');
const workspace = await read('public/message-workspace.js');
const policy = await read('public/message-workspace-policy.js');
const css = await read('public/message-workspace.css');
const sw = await read('public/sw-policy.js');

// The shell only ships the three assets; the panel itself is built at runtime.
assert.equal((html.match(/message-workspace/g) || []).length >= 3, true);
assert.ok(html.includes('<link rel="stylesheet" href="/message-workspace.css" />'));
assert.ok(html.includes('<script src="/message-workspace-policy.js" defer></script>'));
assert.ok(html.includes('<script src="/message-workspace.js" defer></script>'));
assert.ok(html.indexOf('/message-workspace-policy.js') < html.indexOf('/message-workspace.js'));

assert.ok(app.includes("const STORAGE_KEY = 'hafize.conversations.v1'"));
assert.equal(app.includes('hafize.message-workspace.v1'), false);
assert.ok(app.includes("article.className = `message ${message.role}`"));
assert.ok(app.includes('article.dataset.messageId = message.id'));

assert.ok(workspace.includes("const STORAGE_KEY = 'hafize.message-workspace.v1'"));
assert.ok(workspace.includes('const STORAGE_EVENT ='));
assert.ok(workspace.includes('const MAX_RECORDS = 240'));
assert.ok(workspace.includes('const MAX_EXPORT = 100'));
assert.ok(workspace.includes('document.querySelector(\'#messages\')'));
assert.ok(workspace.includes('document.querySelector(\'.utility-rail\')'));
assert.ok(workspace.includes('ui.messages.querySelectorAll'));
assert.ok(workspace.includes('article.dataset.messageId'));
assert.ok(workspace.includes('currentConversationId'));

assert.ok(policy.includes("root.HafizeMessageWorkspacePolicy"));
assert.ok(policy.includes("module.exports = api"));
assert.ok(policy.includes('Object.freeze'));
assert.ok(policy.includes('normalizeRecord'));
assert.ok(policy.includes('normalizeRecords'));

assert.ok(css.includes('.message-workspace-panel'));
assert.ok(css.includes('.message-workspace-action'));
assert.ok(css.includes('.message-workspace-focus'));
assert.ok(css.includes('forced-colors:active'));
assert.ok(css.includes('prefers-reduced-motion:reduce'));

assert.ok(sw.includes("CURRENT_CACHE = `${CACHE_PREFIX}v23`"));
for (const asset of ['/message-workspace.css','/message-workspace-policy.js','/message-workspace.js']) {
  assert.equal((sw.match(new RegExp(asset.replace('.', '\\.'), 'g')) || []).length, 1);
}

assert.ok(workspace.includes("window.setInterval(sweepMissingRecords, 12000)"));
assert.ok(workspace.includes("window.addEventListener('storage'"));
assert.ok(workspace.includes("window.addEventListener(STORAGE_EVENT"));
assert.ok(workspace.includes("window.addEventListener('hafize:conversation-workspace-changed'"));

for (const source of [workspace, policy]) {
  for (const forbidden of ['document.cookie','localStorage.clear(','sessionStorage','indexedDB','fetch(','XMLHttpRequest','WebSocket','Authorization','Bearer ','/api/']) {
    assert.equal(source.includes(forbidden), false, `forbidden integration capability: ${forbidden}`);
  }
}

assert.ok(workspace.includes('new Blob'));
assert.ok(workspace.includes('URL.createObjectURL'));
assert.ok(workspace.includes('URL.revokeObjectURL'));
assert.ok(workspace.includes("type:'application/json'"));

console.log('message workspace integration tests passed');
