import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path,'utf8');
const views = read('public/typed/legacy/prompt-library-smart-views.ts');
assert.match(views,/function normalizeView/);
assert.match(views,/function normalizeViews/);
assert.match(views,/function parseQuery/);
assert.match(views,/function evaluate/);
assert.match(views,/function importPayload/);
assert.match(views,/function exportPayload/);
assert.match(views,/function applyView/);
assert.match(views,/hafize:prompt-library-smart-view-applied/);
assert.doesNotMatch(views,/\.innerHTML\s*=/);

const history = read('public/typed/legacy/prompt-library-smart-views-history.ts');
assert.match(history,/function record/);
assert.match(history,/function applyFromHistory/);
assert.match(history,/MAX_ITEMS = 20/);
assert.match(history,/hafize\.prompt-library\.smart-views-history\.v1/);

const builder = read('public/typed/legacy/prompt-library-smart-views-builder.ts');
assert.match(builder,/function buildQuery/);
assert.match(builder,/function viewFromForm/);
assert.match(builder,/Görünüm olarak kaydet/);

const html = read('public/index.html');
for (const asset of [
  'prompt-library-smart-views.css',
  'prompt-library-smart-views-extras.css',
  'prompt-library-smart-views.js',
  'prompt-library-smart-views-history.js',
  'prompt-library-smart-views-builder.js'
]) assert.ok(html.includes(asset), asset);

const sw = read('public/sw-policy.ts');
assert.match(sw,/CURRENT_CACHE = .*v49/);
for (const asset of [
  '/prompt-library-smart-views.css',
  '/prompt-library-smart-views-extras.css',
  '/prompt-library-smart-views.js',
  '/prompt-library-smart-views-history.js',
  '/prompt-library-smart-views-builder.js'
]) assert.ok(sw.includes(asset), asset);
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view regression contract: ok');