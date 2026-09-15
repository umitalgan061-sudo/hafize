import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-packs.js', 'utf8');
assert.match(source, /PACK_VERSION\s*=\s*1/);
assert.match(source, /MAX_BYTES\s*=\s*1_500_000/);
assert.match(source, /function packageData\(/);
assert.match(source, /function validate\(/);
assert.match(source, /function normalizePack\(/);
assert.match(source, /function importPayload\(/);
assert.equal(source.includes('source: \'hafize-prompt-pack\''), true);
assert.equal(source.includes('promptIds'), true);
assert.equal(source.includes('duplicates'), true);
console.log('prompt workspace packs: ok');
