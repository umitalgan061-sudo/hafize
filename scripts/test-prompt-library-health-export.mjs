import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health-enhancements.js'), 'utf8');

assert.match(source, /reportPayload/);
assert.match(source, /problematicPrompts/);
assert.match(source, /slice\(0, MAX_EXPORT\)/);
assert.match(source, /slice\(0, 120\)/);
assert.match(source, /issue\.severity/);
assert.match(source, /\['error', 'warning'\]/);
assert.match(source, /downloadReport/);
assert.match(source, /downloadProblems/);
assert.match(source, /hafize-prompt-health-/);
assert.match(source, /hafize-prompt-problems-/);
assert.doesNotMatch(source, /data:text\/html/);
assert.doesNotMatch(source, /javascript:/i);
console.log('prompt library health export: ok');
