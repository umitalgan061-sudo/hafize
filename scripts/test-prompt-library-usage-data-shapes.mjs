import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadPublicModule } from './public-module.mjs';

const { normalizeItem } = loadPublicModule('prompt-library.js');

const core = fs.readFileSync('public/prompt-library.js', 'utf8');
const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const docs = fs.readFileSync('docs/PROMPT_LIBRARY_USAGE_INSIGHTS.md', 'utf8');

// The stored shape is asserted by normalizing values, not by grepping for a
// literal default that a refactor can respell without changing behaviour.
assert.equal(normalizeItem({ body: 'gövde' }).useCount, 0, 'a new prompt starts unused');
assert.equal(normalizeItem({ body: 'gövde', useCount: 7 }).useCount, 7);
assert.equal(normalizeItem({ body: 'gövde', useCount: 12345 }).useCount, 9999, 'use counts stay bounded');
assert.equal(normalizeItem({ body: 'gövde', useCount: -3 }).useCount, 0, 'negative counts fall back to zero');
assert.equal(normalizeItem({ body: 'gövde', useCount: 2.7 }).useCount, 2, 'fractional counts are floored');
assert.equal(normalizeItem({ body: 'gövde', useCount: 'çok' }).useCount, 0, 'non-numeric counts fall back to zero');
assert.match(core, /useCount: items\[index\]\.useCount \+ 1/, 'using a prompt increments its counter');
assert.match(usage, /function usageOf\(item\)/);
assert.match(usage, /const value = Number\(item\.useCount\)/);
assert.match(usage, /value >= 0/);
assert.match(usage, /Math\.floor\(value\)/);
assert.match(usage, /Math\.min\(9999/);
assert.match(usage, /function summarize\(items\)/);
assert.match(usage, /const totalUses = valid\.reduce/);
assert.match(usage, /const used = valid\.filter/);
assert.match(usage, /usageOf\(b\) - usageOf\(a\)/);
assert.match(usage, /dateValue\(b\) - dateValue\(a\)/);
assert.match(usage, /slice\(0, MAX_ITEMS\)/);
assert.match(usage, /summary\.total/);
assert.match(usage, /summary\.usedCount/);
assert.match(usage, /summary\.totalUses/);
assert.match(usage, /summary\.top/);
assert.match(usage, /summary\.recent/);
assert.match(docs, /useCount/);
assert.match(docs, /PWA/);
assert.match(docs, /Gizlilik/);

const dangerous = [
  /eval\(/,
  /new Function\(/,
  /document\.write/,
  /insertAdjacentHTML/,
  /innerHTML\s*=/,
  /navigator\.sendBeacon/,
  /fetch\(/,
  /XMLHttpRequest/
];
for (const pattern of dangerous) assert.doesNotMatch(usage, pattern, String(pattern));

console.log('prompt-library usage data-shape contracts: ok');
