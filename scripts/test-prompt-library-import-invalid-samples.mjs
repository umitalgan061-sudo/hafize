import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertBoundDeclared } from './source-contract.mjs';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/invalidSamples/);
// The sample list is bounded by one shared constant, used by the import plan
// and the library analysis alike.
assertBoundDeclared(source,'MAX_PREVIEW_INVALID',6);
assert.match(source,/invalidSamples\.length < MAX_PREVIEW_INVALID/);
assert.match(source,/invalid\.slice\(0, MAX_PREVIEW_INVALID\)/);
assert.match(source,/nesne değil/);
assert.match(source,/body boş/);
console.log('prompt-library-import-invalid-samples: ok');
