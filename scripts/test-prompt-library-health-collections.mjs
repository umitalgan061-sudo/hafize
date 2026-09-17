import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');

assert.match(source, /COLLECTION_KEY\s*=\s*'hafize\.prompt-library\.collections\.v1'/);
assert.match(source, /inspectCollections/);
assert.match(source, /malformed-collection/);
assert.match(source, /duplicate-collection-id/);
assert.match(source, /orphan-member/);
assert.match(source, /empty-collection/);
assert.match(source, /promptIds/);
assert.match(source, /MAX_COLLECTIONS/);
assert.match(source, /members\.slice\(0, 120\)/);
assert.match(source, /if \(!ids\.has\(id\)\)/);
console.log('prompt library health collections: ok');
