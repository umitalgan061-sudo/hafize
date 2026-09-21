import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/prompt-library-smart-insert-shortcuts.js', import.meta.url), 'utf8');
assert.match(source, /ctrlKey/); assert.match(source, /metaKey/); assert.match(source, /shiftKey/);
assert.match(source, /key === 'i'/); assert.match(source, /key === 'l'/); assert.match(source, /key === 'h'/);
assert.match(source, /isTyping/); assert.match(source, /textarea/); assert.match(source, /contentEditable/);
assert.match(source, /openFirstSmartInsert/); assert.match(source, /openCenter/); assert.match(source, /toggleHistory/);
assert.match(source, /preventDefault/); assert.match(source, /destroy/); assert.doesNotMatch(source, /form\.submit|requestSubmit/);
console.log('prompt-library-smart-insert-shortcuts: ok');
