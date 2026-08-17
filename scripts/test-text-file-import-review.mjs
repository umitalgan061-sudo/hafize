import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/text-file-import.js');

assert.equal(api.MAX_FILE_BYTES, 128 * 1024);
assert.equal(api.MAX_FILES, 4);
assert.equal(api.MAX_COMPOSER_CHARS, 12_000);
assert.equal(api.MAX_PREVIEW_CHARS, 180);

assert.equal(api.safeFileName('../secret.txt'), '..-secret.txt');
assert.equal(api.safeFileName('  plan\n\t2026.md  '), 'plan 2026.md');
assert.equal(api.safeFileName('x'.repeat(140)).length, 120);
assert.equal(api.fileExtension('notes.MD'), 'md');
assert.equal(api.fileExtension('.env.example'), 'env.example');

assert.equal(api.isAllowedFile({ name: 'notes.txt', type: 'text/plain', size: 12 }), true);
assert.equal(api.isAllowedFile({ name: 'code.ts', type: '', size: 12 }), true);
assert.equal(api.isAllowedFile({ name: 'image.png', type: 'image/png', size: 12 }), false);
assert.equal(api.isAllowedFile({ name: 'huge.txt', type: 'text/plain', size: api.MAX_FILE_BYTES + 1 }), false);

assert.equal(api.normalizeFileText('a\r\nb\rc\u0000d'), 'a\nb\ncd');
assert.equal(api.normalizeFileText(null), null);
assert.equal(api.formatImport('a.txt', 'merhaba'), '--- Dosya: a.txt ---\nmerhaba\n--- Dosya sonu ---');

const four = [{ name: '1' }, { name: '2' }, { name: '3' }, { name: '4' }];
const normalized = api.normalizeSelection([...four, { name: '5' }]);
assert.equal(normalized.length, 4);
assert.equal(Object.isFrozen(normalized), true);
assert.equal(Object.isFrozen(normalized[0]), true);

assert.equal(api.composeNextValue('', ['A', 'B']), 'A\n\nB');
assert.equal(api.composeNextValue('başlangıç', ['A']), 'başlangıç\n\nA');
assert.equal(api.composeNextValue('x'.repeat(11_999), ['A']), null);
assert.equal(api.composeNextValue('', []), null);
assert.equal(api.composeNextValue('', ['']), null);

const short = api.previewText('  ilk\n ikinci   üçüncü ');
assert.equal(short, 'ilk ikinci üçüncü');
const long = api.previewText('x'.repeat(300));
assert.equal(long.length, 180);
assert.equal(long.endsWith('…'), true);

console.log('text file import review helper tests passed');
