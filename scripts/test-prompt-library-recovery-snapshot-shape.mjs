import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
const generated=source.indexOf('const payload = {');
assert.ok(generated>=0);
assert.ok(source.indexOf('prompts:',generated)>generated);
assert.ok(source.indexOf('collections:',generated)>generated);
assert.ok(source.indexOf('revisions:',generated)>generated);
console.log('prompt-library-recovery-snapshot-shape: ok');
