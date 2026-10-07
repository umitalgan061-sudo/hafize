import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/typed/legacy/prompt-library-smart-views-history.ts','utf8');
assert.match(source,/smart-views-history\.v1/);
assert.match(source,/MAX_ITEMS = 20/);
assert.match(source,/function record\(/);
assert.match(source,/function clear\(/);
assert.match(source,/function remove\(/);
assert.match(source,/hafize:prompt-library-smart-view-applied/);
assert.match(source,/aria-live/);
console.log('smart-view history contract: ok');