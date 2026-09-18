import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.doesNotMatch(source,/navigator\.sendBeacon/);
assert.doesNotMatch(source,/fetch\s*\(/);
assert.doesNotMatch(source,/XMLHttpRequest/);
assert.match(source,/source: 'hafize-prompt-library-recovery'/);
console.log('prompt-library-recovery-privacy: ok');
