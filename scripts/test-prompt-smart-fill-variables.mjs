import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.ts'), 'utf8');
assert.match(text, /function variableNames\(body\)/);
assert.match(text, /core\(\)\?\.extractVariables/);
assert.match(text, /MAX_VARIABLES/);
assert.match(text, /currentValues\(\)/);
assert.match(text, /replaceVariables/);
assert.match(text, /renderPreview/);
assert.match(text, /activeNames\.some/);
assert.match(text, /trim\(\)\.length === 0/);
assert.match(text, /Tüm değişken alanlarını doldur/);
assert.match(text, /composer\.value = text/);
assert.match(text, /composer\.dispatchEvent/);
console.log('prompt smart-fill variables: ok');
