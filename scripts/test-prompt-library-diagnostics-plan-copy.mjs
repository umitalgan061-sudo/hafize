import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
for(const token of ['Onarım planını kopyala','buildRepairPreview','rewrites','clipboard','writeText']) assert.match(source,new RegExp(token));
console.log('prompt-library-diagnostics-plan-copy: ok');
