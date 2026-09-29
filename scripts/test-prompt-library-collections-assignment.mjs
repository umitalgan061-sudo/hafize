import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /function assignPrompt/);
assert.match(source, /function bulkAssignPrompts/);
assert.match(source, /Seçilenleri ata/);
assert.match(source, /Koleksiyonsuz/);
assert.match(source, /delete map\[cleanPromptId\]/);
assert.match(source, /findCollection\(collections, collectionId\)/);
assert.match(source, /ensurePersisted\(\)/);
console.log('prompt library collections assignment: ok');
