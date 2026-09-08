import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

assert.match(source, /let persistenceWarningShown = false;/);
assert.match(source, /function saveConversations\(\) \{\n    try \{/);
assert.match(source, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(conversations\.slice\(0, 30\)\)\);/);
assert.match(source, /persistenceWarningShown = false;/);
assert.match(source, /showToast\('Yerel sohbet geçmişi bu cihazda kalıcı olarak kaydedilemedi\.'\);/);
assert.match(source, /return true;/);
assert.match(source, /return false;/);

console.log('client persistence boundary checks passed');
