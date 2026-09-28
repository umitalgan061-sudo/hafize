import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(s,/index !== messages\.length - 1/);
assert.match(s,/role\?\: unknown/);
assert.match(s,/content\?\: unknown/);
console.log('response eligibility contract ok');