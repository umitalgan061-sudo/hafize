import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertNumericLimit } from './source-contract.mjs';
const source=await fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts','utf8');
assertNumericLimit(source, 'MAX_ORPHANS', 240);
assert.match(source,/orphanMembers/);
assert.match(source,/orphanPromptRefs/);
console.log('prompt-library-repair-relation-cap: ok');
