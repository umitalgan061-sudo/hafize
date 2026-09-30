import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-smart-views.js','utf8');
assert.match(source,/MAX_VIEWS = 24/);
assert.match(source,/MAX_NAME = 72/);
assert.match(source,/MAX_DESCRIPTION = 180/);
assert.match(source,/MAX_QUERY = 180/);
assert.match(source,/MAX_EXPORT = 300000/);
assert.match(source,/function normalizeView/);
assert.match(source,/function normalizeViews/);
assert.match(source,/function safeState/);
console.log('smart-view data limits: ok');