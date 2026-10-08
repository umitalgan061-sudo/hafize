import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const files = [
  'public/typed/legacy/prompt-library-collections.ts',
  'public/typed/legacy/prompt-library-collections-enhancements.ts',
  'public/typed/legacy/prompt-library-revisions.ts',
  'public/typed/legacy/prompt-library-revisions-enhancements.ts',
  'public/prompt-library-collections.css',
  'public/index.html',
  'public/sw-policy.ts'
];
const source = Object.fromEntries(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));

for (const file of files) assert.ok(source[file].length > 0, `${file} is empty`);
assert.match(source['public/index.html'], /prompt-library-collections\.js/);
assert.match(source['public/index.html'], /prompt-library-revisions\.js/);
assert.match(source['public/index.html'], /prompt-library-collections-enhancements\.js/);
assert.match(source['public/index.html'], /prompt-library-revisions-enhancements\.js/);
assert.match(source['public/sw-policy.ts'], /prompt-library-collections\.js/);
assert.match(source['public/sw-policy.ts'], /prompt-library-revisions\.js/);
assert.match(source['public/sw-policy.ts'], /prompt-library-collections\.css/);
assert.match(source['public/sw-policy.ts'], /prompt-library-revisions\.css/);
assertVersionedCacheDeclaration(source['public/sw-policy.ts']);
assert.match(source['public/typed/legacy/prompt-library-collections.ts'], /MAX_COLLECTIONS = 40/);
assert.match(source['public/typed/legacy/prompt-library-collections.ts'], /MAX_MEMBERS = 120/);
assert.match(source['public/typed/legacy/prompt-library-revisions.ts'], /MAX_REVISIONS_PER_PROMPT = 20/);
assert.match(source['public/typed/legacy/prompt-library-revisions.ts'], /MAX_REVISIONS_TOTAL = 600/);
assert.match(source['public/typed/legacy/prompt-library-revisions.ts'], /before-restore/);
assert.match(source['public/typed/legacy/prompt-library-revisions.ts'], /useCount: current.useCount/);
assert.match(source['public/typed/legacy/prompt-library-collections-enhancements.ts'], /Seçilenlerden koleksiyon/);
assert.match(source['public/typed/legacy/prompt-library-revisions-enhancements.ts'], /Geçmişi temizle/);
assert.match(source['public/prompt-library-collections.css'], /forced-colors:active/);
assert.match(source['public/prompt-library-collections.css'], /prefers-reduced-motion:reduce/);

const forbidden = [/innerHTML\s*=/, /document\.write/, /navigator\.sendBeacon/, /XMLHttpRequest/, /WebSocket/, /Authorization\s*:/, /eval\(/, /Function\(/];
for (const file of files.slice(0, 4)) for (const pattern of forbidden) assert.doesNotMatch(source[file], pattern, `${file} violates ${pattern}`);

assert.doesNotMatch(source['public/typed/legacy/prompt-library-collections.ts'], /prompt\.body/);
assert.doesNotMatch(source['public/typed/legacy/prompt-library-revisions.ts'], /localStorage\.clear/);
assert.doesNotMatch(source['public/typed/legacy/prompt-library-revisions.ts'], /removeItem\(['"]hafize\.prompt-library\.v1/);
assert.match(source['public/typed/legacy/prompt-library-revisions.ts'], /observer\?\.disconnect/);
assert.match(source['public/typed/legacy/prompt-library-collections-enhancements.ts'], /beforeunload/);
assert.match(source['public/typed/legacy/prompt-library-revisions-enhancements.ts'], /beforeunload/);

console.log('prompt library collections revisions release gate: ok');
