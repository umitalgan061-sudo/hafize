import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/typed/legacy/prompt-library-smart-views.ts','utf8');
assert.match(source,/function exportPayload/);
assert.match(source,/function importPayload/);
assert.match(source,/version: 1/);
assert.match(source,/source: 'hafize-prompt-library-smart-views'/);
assert.match(source,/existing\.has\(lower\(raw\.name\)\)/);
console.log('smart-view import/export contract: ok');