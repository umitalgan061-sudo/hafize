import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library.js', import.meta.url), 'utf8');
const enhancements = fs.readFileSync(new URL('../public/prompt-library-enhancements.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
assert.doesNotMatch(source, /document\.cookie/);
assert.match(source, /localStorage/);
assert.match(source, /textContent/);
assert.match(source, /FileReader/);
assert.match(source, /URL\.revokeObjectURL/);
assert.doesNotMatch(enhancements, /fetch\s*\(/);
assert.doesNotMatch(enhancements, /XMLHttpRequest/);
// Optional chaining is deliberate: `navigator.clipboard` is undefined on
// insecure origins, so the guarded form is the correct spelling.
assert.match(enhancements, /navigator\??\.clipboard/, 'copy uses the clipboard API');
console.log('test-prompt-library-source: ok');
