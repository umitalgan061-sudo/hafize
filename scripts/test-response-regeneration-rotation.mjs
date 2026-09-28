import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(source,/const \[previous, \.\.\.rest\] = existing/);
assert.match(source,/current: previous/);
assert.match(source,/alternates: nextHistory/);
console.log('alternate rotation contract ok');