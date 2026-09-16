import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
assert.match(source, /function pruneMembers/);
assert.match(source, /const promptIds = readPromptIds\(storage\)/);
assert.match(source, /promptIds\.filter\(\(id\) => promptIds\.has\(id\)\)/);
assert.match(source, /function readPromptIds/);
assert.match(source, /typeof item\.id === 'string'/);
assert.match(source, /filter\(\(item\) => item && typeof item === 'object'/);
assert.match(source, /pruneMembers\(readCollections\(storage\), storage\)/);
assert.match(source, /return normalizeCollections\(collections\)\.map/);
assert.match(source, /collection\.promptIds\.filter/);
assert.match(source, /setMembership/);
assert.doesNotMatch(source, /deletePrompt/);
assert.doesNotMatch(source, /removeItem\([^)]*PROMPT_KEY/);
assert.doesNotMatch(source, /clear\(\)/);
console.log('prompt collection orphan contract: ok');
