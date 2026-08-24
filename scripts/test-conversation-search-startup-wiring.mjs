import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [uiShell, swPolicy, searchSource, guardSource] = await Promise.all([
  readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/conversation-search.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/conversation-storage-guard.js', import.meta.url), 'utf8')
]);

assert.match(uiShell, /CONVERSATION_SEARCH_SCRIPT\s*=\s*['"]\/conversation-search\.js['"]/);
assert.match(uiShell, /CONVERSATION_SEARCH_SCRIPT_ID\s*=\s*['"]hafizeConversationSearchScript['"]/);
assert.match(uiShell, /installConversationStorageGuard\(documentRef\);\s*installConversationSearch\(documentRef\);/s);
assert.match(uiShell, /appendFixedScript\(documentRef, CONVERSATION_SEARCH_SCRIPT_ID, CONVERSATION_SEARCH_SCRIPT\)/);
assert.match(uiShell, /script\.async\s*=\s*false/);

assert.match(swPolicy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
const searchAssetMatches = swPolicy.match(/['"]\/conversation-search\.js['"]/g) || [];
assert.equal(searchAssetMatches.length, 1, 'conversation search must appear exactly once in PWA shell assets');
assert.match(swPolicy, /pathname\.startsWith\(['"]\/api\/['"]\).*network-only/s);

assert.match(searchSource, /HafizeConversationStorageGuard/);
assert.match(searchSource, /guard\.sanitizeStoredValue\(raw\)/);
assert.match(searchSource, /message\?\.role !== 'user' && message\?\.role !== 'assistant'/);
assert.match(searchSource, /addEventListener\?\.\('storage', onStorage\)/);
assert.match(searchSource, /hafize:conversation-storage-merged/);
assert.match(searchSource, /requestAnimationFrame/);

assert.match(guardSource, /MAX_CONVERSATIONS\s*=\s*30/);
assert.match(guardSource, /MAX_MESSAGES_PER_CONVERSATION\s*=\s*200/);
assert.match(guardSource, /MAX_CONVERSATION_CONTENT_CHARS\s*=\s*120_000/);
assert.match(guardSource, /MAX_TOTAL_CONTENT_CHARS\s*=\s*1_200_000/);

console.log('conversation search startup wiring tests passed');