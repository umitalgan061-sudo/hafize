import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/local-data-center-filters.js', 'utf8');
const css = fs.readFileSync('public/local-data-center-filters.css', 'utf8');
for (const label of ['Tümü', 'Sohbet', 'Taslak', 'İstem', 'History', 'Tercih']) assert.match(source, new RegExp(label));
assert.match(source, /type = 'search'/);
assert.match(source, /Yalnız dolu alanlar/);
assert.match(source, /dataset\.localDataId/);
assert.match(source, /toLocaleLowerCase\('tr-TR'\)/);
assert.match(source, /MutationObserver/);
assert.match(css, /max-width:700px/);
assert.match(css, /forced-colors/);
console.log('local data center filters: ok');
