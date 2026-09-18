import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
for(const token of ['version: 1','source: \'hafize-prompt-library-recovery\'','exportedAt','prompts:','collections:','revisions:']) assert.ok(source.includes(token));
console.log('prompt-library-safety-recovery-schema: ok');
