import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /function pruneMap\(collections, map, promptIds = null\)/);
assert.match(source, /validCollections/);
assert.match(source, /validPrompts/);
assert.match(source, /if \(validPrompts && !validPrompts\.has\(promptId\)\) continue/);
assert.match(source, /syncPromptIds\(\)/);
assert.match(source, /const promptIds = items\.map/);
console.log('prompt library collections stale assignment pruning: ok');
