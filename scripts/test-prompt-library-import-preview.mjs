import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-import-preview.js', 'utf8');
assert.match(source, /MAX_FILE\s*=\s*1000000/);
assert.match(source, /stopImmediatePropagation/);
assert.match(source, /normalizeImportedPayload/);
assert.match(source, /mergeImportedItems/);
assert.match(source, /role', 'dialog/);
assert.match(source, /aria-modal/);
assert.match(source, /aria-labelledby/);
assert.match(source, /event\.key === 'Escape'/);
assert.match(source, /event\.key !== 'Tab'/);
assert.match(source, /confirm\.disabled/);
assert.match(source, /StorageEvent/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
console.log('prompt import preview contract: ok');
