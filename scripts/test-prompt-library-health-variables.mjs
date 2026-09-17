import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');

assert.match(source, /MAX_PROMPTS\s*=\s*120/);
assert.match(source, /uniqueVariables > 12/);
assert.match(source, /too-many-variables/);
assert.match(source, /malformed-variable/);
assert.match(source, /\{\{\\s\*\[a-zA-Z0-9_\-\]\{1,32\}\s\*\\s\*\}\}/);
assert.match(source, /\.length === 0/);
console.log('prompt library health variables: ok');
