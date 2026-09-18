import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
assert.match(source,/MAX_ORPHANS\s*=\s*240/);
assert.match(source,/orphanMembers/);
assert.match(source,/orphanPromptRefs/);
console.log('prompt-library-repair-relation-cap: ok');
