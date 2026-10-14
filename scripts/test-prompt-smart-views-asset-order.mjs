import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const views=html.indexOf('/typed-build/legacy-app.js');
const history=html.indexOf('/typed-build/legacy-app.js');
const builder=html.indexOf('/typed-build/legacy-app.js');
const safety=html.indexOf('/typed-build/legacy-app.js');
assert.ok(views>=0 && history>views && builder>history && safety>builder);
console.log('smart-view asset order: ok');