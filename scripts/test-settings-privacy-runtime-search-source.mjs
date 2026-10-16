import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
assert.ok(s.includes('MAX_SEARCH'));
assert.ok(s.includes("filter.value"));
assert.ok(s.includes('item.label + \' \' + item.description'));
assert.ok(s.includes("toLocaleLowerCase('tr-TR')"));
console.log('privacy search source ok');
