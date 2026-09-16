import assert from 'node:assert/strict';
import { loadPublicModule } from './public-module.mjs';
const { LIMITS, normalizeItem, normalizeCollection, safeState } = loadPublicModule('prompt-library.js');

const item = normalizeItem({ title: 'x'.repeat(200), body: 'x'.repeat(9000), tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`), variables: Array.from({ length: 20 }, (_, i) => `v-${i}`) });
assert.equal(item.title.length, LIMITS.maxTitle);
assert.equal(item.body.length, LIMITS.maxBody);
assert.equal(item.tags.length, LIMITS.maxTags);
assert.equal(item.variables.length, LIMITS.maxVariables);
const many = normalizeCollection(Array.from({ length: 200 }, (_, i) => ({ id: String(i), title: `T${i}`, body: 'B' })));
assert.equal(many.length, LIMITS.maxItems);
assert.equal(safeState({ query: 'x'.repeat(999) }).query.length, LIMITS.maxQuery);
console.log('test-prompt-library-bounds: ok');
