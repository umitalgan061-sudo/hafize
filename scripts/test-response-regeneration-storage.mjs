import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(source,/alternates\?: 'string'\[\]|alternates\?: string\[\]/);
assert.match(source,/feedback\?: 'positive' \| 'negative'/);
assert.match(source,/normalizeResponseAlternates\(source\.alternates\)/);
assert.match(source,/MAX_RESPONSE_ALTERNATES/);
console.log('response storage contract ok');