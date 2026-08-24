import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const uiShell = require('../public/ui-shell.js');
const swPolicy = require('../public/sw-policy.js');

assert.equal(uiShell.CONVERSATION_STORAGE_GUARD_SCRIPT, '/conversation-storage-guard.js');
assert.match(swPolicy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.ok(swPolicy.SHELL_ASSETS.includes('/conversation-storage-guard.js'));

const appended = [];
const nodes = new Map();
const documentRef = {
  head: { append(node) { appended.push(node); nodes.set(node.id, node); } },
  getElementById(id) { return nodes.get(id) || null; },
  createElement(tag) { return { tagName: tag.toUpperCase(), id: '', src: '', async: true }; }
};

assert.equal(uiShell.installConversationStorageGuard(documentRef), true);
assert.equal(appended.length, 1);
assert.equal(appended[0].id, 'hafizeConversationStorageGuardScript');
assert.equal(appended[0].src, '/conversation-storage-guard.js');
assert.equal(appended[0].async, false);
assert.equal(uiShell.installConversationStorageGuard(documentRef), false);
assert.equal(appended.length, 1);

const uiSource = await readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8');
const swSource = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(uiSource, /installConversationStorageGuard\(documentRef\)/);
assert.match(swSource, /'\/conversation-storage-guard\.js'/);
assert.match(swSource, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);

const apiRequest = { method: 'GET', url: 'https://hafize.example/api/chat', headers: new Map(), mode: 'cors' };
assert.equal(swPolicy.classifyRequest(apiRequest, 'https://hafize.example'), 'network-only');
const guardRequest = { method: 'GET', url: 'https://hafize.example/conversation-storage-guard.js', headers: new Map(), mode: 'cors' };
assert.equal(swPolicy.classifyRequest(guardRequest, 'https://hafize.example'), 'shell');

console.log('conversation storage guard wiring tests passed');
