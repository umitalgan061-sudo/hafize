import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /textContent = String\(value/);
assert.match(source, /option\.textContent = item\.name/);
assert.match(source, /JSON\.parse/);
assert.match(source, /catch/);
assert.match(source, /URL\.createObjectURL/);
assert.match(source, /URL\.revokeObjectURL/);
assert.doesNotMatch(source, /innerHTML/);
assert.doesNotMatch(source, /outerHTML/);
assert.doesNotMatch(source, /eval\(/);
console.log('prompt library collections security: ok');
