import assert from 'node:assert/strict';
import fs from 'node:fs';
// public/prompt-library.js is a browser UMD bundle: it assigns `module.exports`
// at runtime, which Node cannot statically analyse into named exports, so the
// suite takes the default (CommonJS) export.
import promptLibrary from '../public/prompt-library.js';

const core = fs.readFileSync('public/prompt-library.js', 'utf8');
const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const docs = fs.readFileSync('docs/PROMPT_LIBRARY_USAGE_INSIGHTS.md', 'utf8');

assert.match(core, /useCount/);
assert.match(core, /Math\.min\(9999, Math\.floor\(input\.useCount\)\)/);
assert.match(core, /useCount: items\[index\]\.useCount \+ 1/);

// A prompt starts unused and never carries a hostile counter into the panel.
assert.equal(promptLibrary.normalizeItem({ body: 'yeni istem' }).useCount, 0);
assert.equal(promptLibrary.normalizeItem({ body: 'x', useCount: -5 }).useCount, 0);
assert.equal(promptLibrary.normalizeItem({ body: 'x', useCount: 'çok' }).useCount, 0);
assert.equal(promptLibrary.normalizeItem({ body: 'x', useCount: 12.7 }).useCount, 12);
assert.equal(promptLibrary.normalizeItem({ body: 'x', useCount: 1e9 }).useCount, 9999);
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
