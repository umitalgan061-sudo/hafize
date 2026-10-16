import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertNumericLimit } from './source-contract.mjs';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
assert.match(source,/output\.length > 1000000/);
assert.match(source,/items\.concat\(removed\)\.slice\(-80\)/);
assertNumericLimit(source, 'MAX_ITEMS', 120);
console.log('prompt-library-quarantine-bounds: ok');
