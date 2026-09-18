import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
const pos=source.indexOf('if (seenIds.has(item.id))');
assert.ok(pos>=0);
assert.ok(source.indexOf('randomId()',pos)>pos);
assert.match(source,/normalized\.push\(item\)/);
assert.doesNotMatch(source,/duplicateIds\.add\(item\.id\);\s*continue/);
console.log('prompt-library-repair-preservation: ok');
