import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts','utf8');
for(const token of ['Raporu kopyala','generatedAt','invalidCount','duplicateIdCount','writeText']) assert.match(source,new RegExp(token));
console.log('prompt-library-diagnostics-report-copy: ok');
