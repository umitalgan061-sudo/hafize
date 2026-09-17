import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health-enhancements.js'), 'utf8');

assert.match(source, /HafizePromptLibraryHealthEnhancements/);
assert.match(source, /Raporu indir/);
assert.match(source, /Sorunlu promptları indir/);
assert.match(source, /Yalnızca hata\/uyarı/);
assert.match(source, /MAX_EXPORT\s*=\s*900000/);
assert.match(source, /problematicPrompts/);
assert.match(source, /download\(/);
assert.match(source, /Blob/);
assert.match(source, /createObjectURL/);
assert.match(source, /revokeObjectURL/);
assert.match(source, /slice\(0, 120\)/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
console.log('prompt library health enhancements: ok');
