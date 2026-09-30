import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/conversation-fork-panel/);
assert.match(s,/childrenOf/);
// The accessible name is built from the branch title, so the label reads
// "<title> dalını aç" rather than starting with a capitalised word.
assert.match(s,/' dalını aç'/);
console.log('conversation fork branch panel: ok');
