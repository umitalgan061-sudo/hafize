import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile('public/connector-hub.js','utf8');
assert.match(source,/Tanı özetini kopyala/);
assert.match(source,/lastSnapshot/);
assert.match(source,/navigator\?\.clipboard\?\.writeText/);
assert.match(source,/Hafize Bağlantılar Tanı Özeti/);
assert.match(source,/GitHub:/);
assert.match(source,/Google \/ Gmail:/);
assert.match(source,/Canva:/);
assert.match(source,/Zaman:/);
assert.doesNotMatch(source,/access[_-]?token/i);
assert.doesNotMatch(source,/refresh[_-]?token/i);
assert.doesNotMatch(source,/client_secret/i);

console.log('connector hub diagnostics: passed');