import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html','utf8');
assert.match(html,/prompt-library-smart-views\.css/);
assert.match(html,/prompt-library-smart-views-extras\.css/);
assert.match(html,/prompt-library-smart-views\.js/);
assert.match(html,/prompt-library-smart-views-history\.js/);
assert.match(html,/prompt-library-smart-views-builder\.js/);
console.log('smart-view index integration: ok');