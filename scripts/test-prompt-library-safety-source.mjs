import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
assert.match(source,/Object\.freeze\(/);
assert.match(source,/root\.HafizePromptLibrarySafety/);
assert.match(source,/CustomEvent\('hafize:prompt-library-safety-changed'/);
assert.match(source,/try \{/);
assert.match(source,/catch \{/);
console.log('prompt-library-safety-source: ok');
