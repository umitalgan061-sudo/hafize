import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.ok((source.match(/hafize:prompt-library-safety-changed/g)||[]).length>=3);
console.log('prompt-library-safety-eventing: ok');
