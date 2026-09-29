import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /knownPromptIds/);
assert.match(source, /!knownPromptIds\.has\(item\.id\)/);
assert.match(source, /defaultCollection/);
assert.match(source, /Yeni istemler için varsayılan koleksiyon/);
assert.match(source, /Otomatik atama kapalı/);
assert.match(source, /saveDefaultCollection\(value\)/);
assert.doesNotMatch(source, /knownPromptIds = new Set\(\[\]\)/);
console.log('prompt library collections default assignment: ok');
