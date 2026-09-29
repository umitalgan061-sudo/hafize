import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /DEFAULT_KEY/);
assert.match(source, /loadDefaultCollection/);
assert.match(source, /saveDefaultCollection/);
assert.match(source, /knownPromptIds = new Set/);
assert.match(source, /!knownPromptIds\.has\(item\.id\)/);
assert.match(source, /!next\[item\.id\]/);
assert.match(source, /saveDefaultCollection\(NONE\)/);
console.log('prompt library collections default data contract: ok');
