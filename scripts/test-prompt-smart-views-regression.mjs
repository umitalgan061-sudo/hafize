import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertShippedBrowserModule, assertShippedStylesheet } from './shell-cache-contract.mjs';

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
assertShippedStylesheet('prompt-library-smart-views.css');
assertShippedStylesheet('prompt-library-smart-views-extras.css');
assertShippedBrowserModule('prompt-library-smart-views');
assertShippedBrowserModule('prompt-library-smart-views-history');
assertShippedBrowserModule('prompt-library-smart-views-builder');

const sw = read('public/sw-policy.ts');
assert.match(sw,/CURRENT_CACHE = .*v49/);
assertShippedStylesheet('prompt-library-smart-views.css');
assertShippedStylesheet('prompt-library-smart-views-extras.css');
assertShippedBrowserModule('prompt-library-smart-views');
assertShippedBrowserModule('prompt-library-smart-views-history');
assertShippedBrowserModule('prompt-library-smart-views-builder');
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view regression contract: ok');