import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
assert.match(source, /function setMembership\(collectionId, promptIds/);
assert.match(source, /readPromptIds\(storage\)/);
assert.match(source, /\.filter\(\(id\) => typeof id === 'string' && allowed\.has\(id\)\)/);
assert.match(source, /slice\(0, MAX_MEMBERS\)/);
assert.match(source, /new Set\(Array\.isArray\(promptIds\)/);
assert.match(source, /function addMembers\(collectionId/);
assert.match(source, /function removeMembers\(collectionId/);
assert.match(source, /return setMembership\(collectionId/);
assert.match(source, /promptIds: members/);
assert.match(source, /collectionId/);
assert.doesNotMatch(source, /prompt\.body/);
assert.doesNotMatch(source, /JSON\.stringify\([^)]*body/);
console.log('prompt collection membership contract: ok');
