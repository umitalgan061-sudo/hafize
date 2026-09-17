import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace-backup.js', 'utf8');

assert.match(source, /prompt-library-collections-workspace-backup/);
assert.match(source, /Yedeği dışa aktar/);
assert.match(source, /Yedeği içe aktar/);
assert.match(source, /MAX_IMPORT_BYTES\s*=\s*500_000/);
assert.match(source, /file\.size > MAX_IMPORT_BYTES/);
assert.match(source, /JSON\.parse\(await file\.text\(\)\)/);
assert.match(source, /api\.export\(\)/);
assert.match(source, /api\.import\(payload\)/);
assert.match(source, /URL\.createObjectURL/);
assert.match(source, /URL\.revokeObjectURL/);
assert.match(source, /application\/json/);
assert.equal(source.includes('fetch('), false);
assert.equal(source.includes('innerHTML'), false);
assert.equal(source.includes('outerHTML'), false);

console.log('prompt collection workspace backup: ok');
