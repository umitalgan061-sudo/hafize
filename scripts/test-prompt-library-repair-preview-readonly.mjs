import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertFunctionSource } from './source-contract.mjs';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
// Brace-matched so that a function added after `buildRepairPreview` cannot
// widen the slice and make a neighbour's write look like a preview write.
const preview=assertFunctionSource(source,'buildRepairPreview');
assert.doesNotMatch(preview,/setItem/);
assert.doesNotMatch(preview,/saveItems/);
assert.doesNotMatch(preview,/removeItem/);
console.log('prompt-library-repair-preview-readonly: ok');
