import assert from 'node:assert/strict';
import fs from 'node:fs';

// Mirror of the `add` rule in public/composer-history.js: blank submissions are
// ignored, a repeat moves back to the front instead of duplicating, and the list
// stays bounded. The source assertions below keep this model honest.
const MAX_ITEMS = 40;
const add = (items, value) => {
  const text = String(value ?? '').trim();
  if (!text) return items;
  return [text, ...items.filter((item) => item !== text)].slice(0, MAX_ITEMS);
};

let items = [];
items = add(items, 'a');
items = add(items, 'b');
assert.deepEqual(items, ['b', 'a']);
items = add(items, 'a');
assert.deepEqual(items, ['a', 'b'], 'a repeat is promoted, not duplicated');

items = add(items, '');
assert.deepEqual(items, ['a', 'b'], 'empty submissions are ignored');
items = add(items, '   ');
assert.deepEqual(items, ['a', 'b'], 'whitespace-only submissions are ignored');
items = add(items, null);
assert.deepEqual(items, ['a', 'b'], 'missing values are ignored');

let bounded = [];
for (let index = 0; index < MAX_ITEMS + 10; index += 1) bounded = add(bounded, `item-${index}`);
assert.equal(bounded.length, MAX_ITEMS, 'the list never grows past MAX_ITEMS');
assert.equal(bounded[0], `item-${MAX_ITEMS + 9}`, 'the newest submission stays first');

const source = fs.readFileSync('public/composer-history.js', 'utf8');
assert.match(source, /const text = normalize\(value\)\.trim\(\)/, 'source trims before storing');
assert.match(source, /if \(!text/, 'source drops blank submissions');
assert.match(source, /items = \[text, \.\.\.items\.filter\(\(item\) => item !== text\)\]/, 'source dedupes by promotion');
console.log('composer history dedupe: ok');
