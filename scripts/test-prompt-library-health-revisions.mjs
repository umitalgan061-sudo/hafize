import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');

assert.match(source, /REVISION_KEY\s*=\s*'hafize\.prompt-library\.revisions\.v1'/);
assert.match(source, /inspectRevisions/);
assert.match(source, /malformed-revision/);
assert.match(source, /orphan-revision/);
assert.match(source, /revision\.promptId/);
assert.match(source, /revisions\.slice\(0, MAX_REVISIONS\)/);
assert.match(source, /if \(promptId && !ids\.has\(promptId\)\)/);
assert.doesNotMatch(source, /revisions\.splice/);
console.log('prompt library health revisions: ok');
