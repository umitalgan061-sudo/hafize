import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const guard = html.indexOf('id="hafizeConversationStorageGuardScript"');
const controller = html.indexOf('src="/chat-run-controller.js"');
const app = html.indexOf('src="/app.js"');
const shell = html.indexOf('src="/ui-shell.js"');

assert.ok(guard >= 0, 'conversation guard must be loaded explicitly');
assert.ok(controller > guard, 'guard must run before chat controller');
assert.ok(app > controller, 'app must remain after chat controller');
assert.ok(shell > app, 'ui shell remains an enhancement layer');
assert.match(html, /<script id="hafizeConversationStorageGuardScript" src="\/conversation-storage-guard\.js" defer><\/script>/);

const guardSource = await readFile(new URL('../public/conversation-storage-guard.js', import.meta.url), 'utf8');
assert.match(guardSource, /root\.HafizeConversationStorageGuard = api;\s*api\.install\(root\);/s);
assert.doesNotMatch(guardSource, /DOMContentLoaded[^\n]+install/);

const shellSource = await readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8');
assert.match(shellSource, /CONVERSATION_STORAGE_GUARD_SCRIPT_ID = 'hafizeConversationStorageGuardScript'/);
assert.match(shellSource, /getElementById\?\.\(id\)/);

console.log('conversation storage bootstrap order: ok');
