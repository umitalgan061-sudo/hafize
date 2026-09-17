import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

assert.match(source, /MAX_IMPORT_BYTES\s*=\s*500_000/);
assert.match(source, /MAX_EXPORT_BYTES\s*=\s*750_000/);
assert.match(source, /exportWorkspace\(workspace\)/);
assert.match(source, /metadataByName/);
assert.match(source, /importWorkspace\(payload, workspace\)/);
assert.match(source, /api\.importPayload\(payload, storage\(\)\)/);
assert.match(source, /beforeIds/);
assert.match(source, /result\.imported/);
assert.match(sw, /\/prompt-library-collections-workspace\.js/);
assert.match(sw, /\/prompt-library-collections-workspace\.css/);
assert.match(index, /\/prompt-library-collections-workspace\.css/);
assert.match(index, /\/prompt-library-collections-workspace\.js/);

assert.equal(source.includes('window.open('), false);
assert.equal(source.includes('location.href ='), false);

console.log('prompt collection workspace import/export: ok');
