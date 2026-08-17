import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/text-file-import.js');

for (const [name, expected] of [
  ['../../token.txt', '..-..-token.txt'],
  ['folder\\secret.md', 'folder-secret.md'],
  ['a\u0000b\u0007c.txt', 'a b c.txt'],
  ['   spaced    file.md   ', 'spaced file.md']
]) {
  assert.equal(api.safeFileName(name), expected);
}

const hostile = '<img src=x onerror=alert(1)>\n<script>steal()</script>\u0000';
const normalized = api.normalizeFileText(hostile);
assert.equal(normalized.includes('\u0000'), false);
assert.equal(normalized.includes('<script>'), true, 'plain text must remain text instead of being parsed or rewritten');
assert.equal(api.previewText(hostile).includes('<img'), true);

const formatted = api.formatImport('evil</textarea>.txt', hostile);
assert.match(formatted, /^--- Dosya: evil<\/textarea>\.txt ---/);
assert.match(formatted, /<script>steal\(\)<\/script>/);

const exactLimit = 'x'.repeat(api.MAX_COMPOSER_CHARS);
assert.equal(api.composeNextValue('', [exactLimit]), exactLimit);
assert.equal(api.composeNextValue('x', ['y'.repeat(api.MAX_COMPOSER_CHARS)]), null);

for (const file of [
  { name: 'payload.exe', type: 'application/octet-stream', size: 10 },
  { name: 'photo.jpg', type: 'image/jpeg', size: 10 },
  { name: 'noext', type: 'text/plain', size: 10 },
  { name: 'too-big.md', type: 'text/markdown', size: api.MAX_FILE_BYTES + 1 }
]) {
  assert.equal(api.isAllowedFile(file), false);
}

assert.equal(api.isAllowedFile({ name: 'safe.json', type: 'application/json', size: 0 }), true);
assert.equal(api.isAllowedFile({ name: 'safe.yaml', type: '', size: api.MAX_FILE_BYTES }), true);

const selection = api.normalizeSelection(new Array(20).fill(null).map((_, index) => ({ name: `${index}.txt` })));
assert.equal(selection.length, api.MAX_FILES);

console.log('text file import review adversarial tests passed');
