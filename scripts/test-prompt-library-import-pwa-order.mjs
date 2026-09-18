import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/index.html','utf8');
const safety=source.indexOf('/prompt-library-safety.js');
const preview=source.indexOf('/prompt-library-import-preview.js');
const diagnostics=source.indexOf('/prompt-library-diagnostics.js');
assert.ok(safety>=0 && preview>safety && diagnostics>preview);
console.log('prompt-library-import-pwa-order: ok');
