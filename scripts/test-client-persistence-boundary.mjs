import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertBoundDeclared } from './source-contract.mjs';

const source = await readFile(new URL('../public/typed/app-shell.ts', import.meta.url), 'utf8');

assert.match(source, /let persistenceWarningShown = false;/);
assert.match(source, /function saveConversations\(\) \{\n    try \{/);
// The cap is applied when the list is normalized, then the bounded list is
// written, so the bound is named rather than inlined at the write.
assert.match(source, /slice\(0, MAX_CONVERSATIONS\)/);
assert.match(source, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(conversations\)\);/);
assertBoundDeclared(source, 'MAX_CONVERSATIONS', 30);
assert.match(source, /persistenceWarningShown = false;/);
assert.match(source, /showToast\('Yerel sohbet geçmişi bu cihazda kalıcı olarak kaydedilemedi\.'\);/);
assert.match(source, /return true;/);
assert.match(source, /return false;/);

console.log('client persistence boundary checks passed');
