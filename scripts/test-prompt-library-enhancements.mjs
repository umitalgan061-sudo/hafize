import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library-enhancements.js', import.meta.url), 'utf8');
assert.match(source, /dataset\.promptEnhancement/, 'toolbar actions carry their action in a data attribute');
assert.match(source, /Kopyala/);
assert.match(source, /Çoğalt/);
assert.match(source, /Filtreleri sıfırla/);
assert.match(source, /Başlangıç seti/);
assert.match(source, /bulk-delete/);
assert.match(source, /bulk-clear/);
assert.match(source, /StorageEvent/);
assert.match(source, /syncCore/);
assert.match(source, /MutationObserver/);
assert.match(source, /beforeunload/);
console.log('test-prompt-library-enhancements: ok');
