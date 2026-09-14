import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
assert.doesNotMatch(source, /document\.cookie/);
assert.match(source, /localStorage/);
assert.match(source, /textContent/);
assert.match(source, /MAX_IMPORT/);
assert.match(source, /MAX_ITEMS/);
assert.match(source, /FileReader/);
assert.match(source, /URL\.revokeObjectURL/);
console.log('test-prompt-library-source: ok');
