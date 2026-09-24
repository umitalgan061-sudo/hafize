import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/typed/app-shell.ts', import.meta.url), 'utf8');

assert.match(source, /let persistenceWarningShown = false;/);
assert.match(source, /function saveConversations\(\) \{\n    try \{/);
// Kayıt sınırı artık `MAX_CONVERSATIONS` üzerinden, yazmadan hemen önce
// uygulanır; depolamaya sınırlandırılmış liste yazılır.
assert.match(source, /const MAX_CONVERSATIONS = 30;/);
assert.match(source, /conversations = conversations[^\n]*\.slice\(0, MAX_CONVERSATIONS\);/);
assert.match(source, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(conversations\)\);/);
assert.match(source, /persistenceWarningShown = false;/);
assert.match(source, /showToast\('Yerel sohbet geçmişi bu cihazda kalıcı olarak kaydedilemedi\.'\);/);
assert.match(source, /return true;/);
assert.match(source, /return false;/);

console.log('client persistence boundary checks passed');
