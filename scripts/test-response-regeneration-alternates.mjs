import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(source,/MAX_RESPONSE_ALTERNATES = 3/);
assert.match(source,/rememberResponseAlternate/);
assert.match(source,/restoreLatestResponseAlternate/);
assert.match(source,/slice\(0, maxItems\)/);
console.log('alternate bounds contract ok');