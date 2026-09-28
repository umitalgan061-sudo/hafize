import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/navigator\.clipboard/);
assert.match(s,/Asistan yanıtını panoya kopyala/);
assert.doesNotMatch(s,/fetch\([^)]*clipboard/);
console.log('response copy contract ok');