// The sidebar branch panel lists the direct children of the active conversation
// and offers compare/open actions for each one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { directChildren } from '../public/typed/conversation-fork-core.ts';

const source = readFileSync('public/typed/conversation-forks.ts', 'utf8');

assert.match(source, /conversation-fork-panel/);
assert.match(source, /conversation-fork-list/);
assert.match(source, /childrenOf\(active\.id, all\)/);
assert.match(source, /dalını aç/);
assert.match(source, /hafize:open-conversation/);
assert.match(source, /Karşılaştır/);
// Rows are built with the element API, never with innerHTML.
assert.doesNotMatch(source, /innerHTML/);

// `childrenOf` is the shared core helper, and it only returns direct children.
const all = [
  { id: 'root' },
  { id: 'a', forkOf: 'root' },
  { id: 'b', forkOf: 'root' },
  { id: 'c', forkOf: 'a' }
];
assert.deepEqual(directChildren('root', all).map((item) => item.id), ['a', 'b']);
assert.deepEqual(directChildren('a', all).map((item) => item.id), ['c']);
assert.deepEqual(directChildren('missing', all), []);

console.log('conversation fork branch panel: ok');
