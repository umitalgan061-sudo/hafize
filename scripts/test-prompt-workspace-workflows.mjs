import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-workflows.js', 'utf8');
assert.match(source, /MAX_WORKFLOWS\s*=\s*24/);
assert.match(source, /MAX_STEPS\s*=\s*8/);
assert.match(source, /mode === 'append'/);
assert.match(source, /core\(\)\.replaceVariables/);
assert.match(source, /function compile\(/);
assert.match(source, /function compose\(/);
assert.equal(source.includes('submit'), false);
assert.equal(source.includes('/api/'), false);
console.log('prompt workspace workflows: ok');
