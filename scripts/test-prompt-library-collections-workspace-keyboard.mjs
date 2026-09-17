import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

assert.match(source, /event\.ctrlKey\s*\|\|\s*event\.metaKey/);
assert.match(source, /event\.shiftKey/);
assert.match(source, /event\.key\.toLowerCase\(\)\s*===\s*'l'/);
assert.match(source, /search\.focus\(\)/);
assert.match(source, /search\.select\(\)/);
assert.match(source, /event\.key\s*===\s*'Enter'/);
assert.match(source, /event\.key\s*===\s*'ArrowUp'/);
assert.match(source, /event\.key\s*===\s*'ArrowDown'/);
assert.match(source, /event\.key\.toLowerCase\(\)\s*===\s*'f'/);
assert.match(source, /event\.key\.toLowerCase\(\)\s*===\s*'a'/);
assert.match(source, /event\.key\s*===\s*'Delete'/);
assert.match(source, /event\.key\s*===\s*'Escape'/);
assert.match(source, /moveFocus\(row, -1\)/);
assert.match(source, /moveFocus\(row, 1\)/);
assert.match(source, /trapDialogTab/);
assert.match(source, /event\.preventDefault\(\)/);

const editableGuard = source.match(/active\?\.matches\?\('input,textarea,select,\[contenteditable="true"\]'\)/g) || [];
assert.ok(editableGuard.length >= 2, 'shortcuts should respect editable controls');

console.log('prompt collection workspace keyboard: ok');
