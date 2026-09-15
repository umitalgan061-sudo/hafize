import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-smart-insert.js', 'utf8');
assert.match(source, /MAX_APPEND\s*=\s*4/);
assert.match(source, /MAX_LENGTH\s*=\s*12000/);
assert.match(source, /function compose\(/);
assert.match(source, /function insert\(/);
assert.match(source, /messageInput/);
assert.match(source, /dispatchEvent\(new Event\('input'/);
assert.equal(source.includes('submit()'), false);
assert.equal(source.includes('form.submit'), false);
console.log('prompt workspace smart insert: ok');
