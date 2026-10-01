import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertFocusRestored, assertFunctionDeclared } from './source-contract.mjs';

const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.ts'), 'utf8');
assertFunctionDeclared(text, 'variableNames');
assert.match(text, /core\(\)\?\.extractVariables/);
assert.match(text, /MAX_VARIABLES/);
assert.match(text, /currentValues\(\)/);
assert.match(text, /replaceVariables/);
assert.match(text, /renderPreview/);
assert.match(text, /activeNames\.(?:some|filter)\(/, 'empty values are detected across the active variables');
assert.match(text, /trim\(\)\.length === 0/);
assert.match(text, /Doldurulmamış değişkenler/, 'submitting with empty values names them');
assert.match(text, /composer\.value = text/);
assert.match(text, /composer\.dispatchEvent/);
console.log('prompt smart-fill variables: ok');
