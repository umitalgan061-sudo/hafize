import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /rootRef\.confirm/);
assert.match(s, /Bu istemin tüm sürüm geçmişi temizlensin mi\?/);
assert.match(s, /Bu eski sürüm silinsin mi\?/);
assert.match(s, /sürümü geri yüklensin mi\?/);
assert.match(s, /if \(!rootRef\.confirm/);
console.log('revision destructive confirmations: ok');
