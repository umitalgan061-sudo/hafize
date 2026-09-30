import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const views=html.indexOf('/prompt-library-smart-views.js');
const history=html.indexOf('/prompt-library-smart-views-history.js');
const builder=html.indexOf('/prompt-library-smart-views-builder.js');
const safety=html.indexOf('/prompt-library-smart-views-safety.js');
assert.ok(views>=0 && history>views && builder>history && safety>builder);
console.log('smart-view asset order: ok');