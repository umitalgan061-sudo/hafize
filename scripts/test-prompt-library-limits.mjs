import assert from 'node:assert/strict';
import { LIMITS, normalizeItem, normalizeCollection, safeState } from '../public/prompt-library.js';

const oversized = normalizeItem({
  title: 'x'.repeat(LIMITS.MAX_TITLE + 50),
  body: 'x'.repeat(LIMITS.MAX_BODY + 50),
  tags: Array.from({ length: LIMITS.MAX_TAGS + 5 }, (_v, i) => `tag-${i}`),
  variables: Array.from({ length: LIMITS.MAX_VARIABLES + 5 }, (_v, i) => `v-${i}`)
});
assert.equal(oversized.title.length, LIMITS.MAX_TITLE);
assert.equal(oversized.body.length, LIMITS.MAX_BODY);
assert.equal(oversized.tags.length, LIMITS.MAX_TAGS);
assert.equal(oversized.variables.length, LIMITS.MAX_VARIABLES);
const items = normalizeCollection(Array.from({ length: LIMITS.MAX_ITEMS + 20 }, (_v, i) => ({ id: String(i), body: `body-${i}`, title: `title-${i}` })));
assert.equal(items.length, LIMITS.MAX_ITEMS);
const state = safeState({ query: 'x'.repeat(500) });
assert.equal(state.query.length, LIMITS.MAX_QUERY);
console.log('test-prompt-library-limits: ok');
