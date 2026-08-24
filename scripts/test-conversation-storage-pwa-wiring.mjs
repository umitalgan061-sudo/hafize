import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policySource = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const shellSource = await readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8');

assert.match(policySource, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(policySource, /'\/conversation-storage-guard\.js'/);
assert.match(indexSource, /id="hafizeConversationStorageGuardScript" src="\/conversation-storage-guard\.js" defer/);
assert.match(shellSource, /CONVERSATION_STORAGE_GUARD_SCRIPT_ID = 'hafizeConversationStorageGuardScript'/);
assert.match(shellSource, /appendFixedScript\(documentRef, CONVERSATION_STORAGE_GUARD_SCRIPT_ID, CONVERSATION_STORAGE_GUARD_SCRIPT\)/);

const apiBranch = policySource.match(/if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only';/);
assert.ok(apiBranch, 'API responses must remain network-only');
assert.doesNotMatch(policySource, /\/api\/[^'"\s]+['"]/);

const guardIndex = indexSource.indexOf('/conversation-storage-guard.js');
const appIndex = indexSource.indexOf('/app.js');
assert.ok(guardIndex >= 0 && appIndex > guardIndex);

console.log('conversation storage PWA wiring: ok');
