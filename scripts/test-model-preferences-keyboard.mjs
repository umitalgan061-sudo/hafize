import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences-ui.ts'),'utf8');
assert.match(source,/event\.key\.toLowerCase\(\) !== 'm'/);
assert.match(source,/event\.ctrlKey \|\| event\.metaKey/);
assert.match(source,/event\.shiftKey/);
assert.match(source,/HTMLInputElement/);
assert.match(source,/HTMLTextAreaElement/);
assert.match(source,/HTMLSelectElement/);
console.log('model preferences keyboard guard ok');
