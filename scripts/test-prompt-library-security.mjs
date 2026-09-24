import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('../public/typed/prompt-library.ts', import.meta.url), 'utf8');
const enhancement = fs.readFileSync(new URL('../public/prompt-library-enhancements.js', import.meta.url), 'utf8');
assert.doesNotMatch(core, /document\.cookie/);
assert.doesNotMatch(core, /Authorization/);
assert.doesNotMatch(core, /Bearer/);
assert.doesNotMatch(core, /fetch\s*\(/);
assert.doesNotMatch(enhancement, /fetch\s*\(/);
assert.doesNotMatch(enhancement, /WebSocket/);
assert.match(core, /textContent/);
assert.match(core, /replaceChildren/);
assert.match(core, /maxImport/);
assert.match(core, /maxItems/);
console.log('test-prompt-library-security: ok');
