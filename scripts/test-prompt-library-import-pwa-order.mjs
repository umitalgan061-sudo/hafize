import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/index.html','utf8');
const safety=source.indexOf('/typed-build/legacy-app.js');
const preview=source.indexOf('/typed-build/legacy-app.js');
const diagnostics=source.indexOf('/typed-build/legacy-app.js');
assert.ok(safety>=0 && preview>safety && diagnostics>preview);
console.log('prompt-library-import-pwa-order: ok');
