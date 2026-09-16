import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'public/prompt-library-collections.js',
  'public/prompt-library-collections-enhancements.js',
  'public/prompt-library-revisions.js',
  'public/prompt-library-revisions-enhancements.js',
  'public/prompt-library-collections.css',
  'public/index.html',
  'public/sw-policy.js'
];
const source = Object.fromEntries(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));

for (const file of files) assert.ok(source[file].length > 0, `${file} is empty`);
assert.match(source['public/index.html'], /prompt-library-collections\.js/);
assert.match(source['public/index.html'], /prompt-library-revisions\.js/);
assert.match(source['public/index.html'], /prompt-library-collections-enhancements\.js/);
assert.match(source['public/index.html'], /prompt-library-revisions-enhancements\.js/);
assert.match(source['public/sw-policy.js'], /prompt-library-collections\.js/);
assert.match(source['public/sw-policy.js'], /prompt-library-revisions\.js/);
assert.match(source['public/sw-policy.js'], /prompt-library-collections\.css/);
assert.match(source['public/sw-policy.js'], /prompt-library-revisions\.css/);
assert.match(source['public/sw-policy.js'], /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(source['public/prompt-library-collections.js'], /MAX_COLLECTIONS = 40/);
assert.match(source['public/prompt-library-collections.js'], /MAX_MEMBERS = 120/);
assert.match(source['public/prompt-library-revisions.js'], /MAX_REVISIONS_PER_PROMPT = 20/);
assert.match(source['public/prompt-library-revisions.js'], /MAX_REVISIONS_TOTAL = 600/);
assert.match(source['public/prompt-library-revisions.js'], /before-restore/);
assert.match(source['public/prompt-library-revisions.js'], /useCount: current.useCount/);
assert.match(source['public/prompt-library-collections-enhancements.js'], /Seçilenlerden koleksiyon/);
assert.match(source['public/prompt-library-revisions-enhancements.js'], /Geçmişi temizle/);
assert.match(source['public/prompt-library-collections.css'], /forced-colors:active/);
assert.match(source['public/prompt-library-collections.css'], /prefers-reduced-motion:reduce/);

const forbidden = [/innerHTML\s*=/, /document\.write/, /navigator\.sendBeacon/, /XMLHttpRequest/, /WebSocket/, /Authorization\s*:/, /eval\(/, /Function\(/];
for (const file of files.slice(0, 4)) for (const pattern of forbidden) assert.doesNotMatch(source[file], pattern, `${file} violates ${pattern}`);

assert.doesNotMatch(source['public/prompt-library-collections.js'], /prompt\.body/);
assert.doesNotMatch(source['public/prompt-library-revisions.js'], /localStorage\.clear/);
assert.doesNotMatch(source['public/prompt-library-revisions.js'], /removeItem\(['"]hafize\.prompt-library\.v1/);
assert.match(source['public/prompt-library-revisions.js'], /observer\?\.disconnect/);
assert.match(source['public/prompt-library-collections-enhancements.js'], /beforeunload/);
assert.match(source['public/prompt-library-revisions-enhancements.js'], /beforeunload/);

console.log('prompt library collections revisions release gate: ok');
