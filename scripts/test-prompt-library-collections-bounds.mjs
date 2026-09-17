import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
const required = [
  /MAX_COLLECTIONS = 40/,
  /MAX_MEMBERS = 120/,
  /MAX_NAME = 80/,
  /MAX_DESCRIPTION = 240/,
  /MAX_QUERY = 100/,
  /slice\(0, MAX_COLLECTIONS \* 2\)/,
  /slice\(0, MAX_MEMBERS\)/,
  /slice\(0, MAX_NAME\)|MAX_NAME\)/,
  /slice\(0, MAX_DESCRIPTION\)|MAX_DESCRIPTION\)/,
  // The query is bounded through the shared `clip` helper and the input's
  // own maxLength, not by an inline slice.
  /clip\(search\.value, MAX_QUERY\)/,
  /search\.maxLength = MAX_QUERY/,
  /500_000/,
  /filter\(\(id\) => typeof id === 'string'/,
  /new Set\(/,
  /saveCollections\(/,
  /return false;/
];
for (const pattern of required) assert.match(source, pattern);
assert.doesNotMatch(source, /MAX_COLLECTIONS\s*=\s*1000/);
assert.doesNotMatch(source, /MAX_MEMBERS\s*=\s*1000/);
console.log('prompt library collections bounds: ok');
