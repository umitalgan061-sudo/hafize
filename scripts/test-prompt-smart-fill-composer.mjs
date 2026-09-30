import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /insertMode\.value === 'append'/);
assert.match(source, /\\n\\n\$\{message\}/);
assert.match(source, /\.slice\(0, 12000\)/);
assert.match(source, /Doldurulmamış değişkenler/);
assert.match(source, /composer\.dispatchEvent/);
assert.match(source, /form/);
assert.doesNotMatch(source, /composer\.form\?\.submit/);

console.log('smart-fill composer contract: ok');
