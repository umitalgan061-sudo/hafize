import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
assert.ok(s.includes('privacy-data-filter-controls'));
assert.ok(s.includes("filter.type = 'search'"));
assert.ok(s.includes('MAX_SEARCH'));
console.log('privacy final search gate ok');
