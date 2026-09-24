import assert from 'node:assert/strict';
import fs from 'node:fs';

const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const enhancements = fs.readFileSync('public/prompt-library-enhancements.js', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

const requiredUsageClasses = [
  'prompt-library-usage-insights',
  'prompt-library-usage-head',
  'prompt-library-usage-body',
  'prompt-library-usage-stats',
  'prompt-library-usage-stat',
  'prompt-library-usage-value',
  'prompt-library-usage-label',
  'prompt-library-usage-subtitle',
  'prompt-library-usage-list',
  'prompt-library-usage-row',
  'prompt-library-usage-rank',
  'prompt-library-usage-name',
  'prompt-library-usage-count'
];

for (const className of requiredUsageClasses) assert.match(usage + fs.readFileSync('public/prompt-library.css', 'utf8'), new RegExp(className));
assert.equal((usage.match(/Kullanım istatistikleri/g) || []).length, 1);
assert.match(usage, /totalUses/);
assert.match(usage, /usedCount/);
assert.match(usage, /slice\(0, MAX_ITEMS\)/);
assert.match(usage, /rootRef\.localStorage/);
assert.match(usage, /rootRef\.addEventListener\?\.\('storage'/);
assert.match(usage, /observer\?\.observe/);
assert.match(usage, /observer\?\.disconnect/);
assert.match(usage, /section\.remove\(\)/);
assert.match(usage, /mounted: true/);
// Kullanım paneli artık index.html tarafından doğrudan yüklenir; enhancements
// betiğinin script enjeksiyonu kaldırıldı. Sözleşme yükleme biçimi değil,
// modülün sayfaya girmesi ve çevrimdışı kabukta bulunmasıdır.
assert.match(index, /<script src="\/prompt-library-usage\.js" defer><\/script>/);
assert.match(sw, /\/prompt-library-usage\.js/);
assert.match(index, /\/prompt-library\.js/);
assert.match(index, /\/prompt-library-enhancements\.js/);
assert.doesNotMatch(usage, /document\.write/);
assert.doesNotMatch(usage, /insertAdjacentHTML/);
assert.doesNotMatch(usage, /\.innerHTML\s*=/);
assert.doesNotMatch(usage, /navigator\.sendBeacon/);
console.log('prompt-library usage regression: ok');
