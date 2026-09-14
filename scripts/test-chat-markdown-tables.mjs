import assert from 'node:assert/strict';
import { parseMarkdown, splitTableRow } from '../public/chat-markdown.js';

assert.deepEqual(splitTableRow('| A | B |'), ['A', 'B']);
assert.deepEqual(splitTableRow('A | B'), ['A', 'B']);
assert.deepEqual(splitTableRow('| `A|B` | C |'), ['`A|B`', 'C']);

const aligned = parseMarkdown('| A | B | C |\n| :--- | :---: | ---: |\n| x | y | z |');
assert.equal(aligned[0].type, 'table');
assert.deepEqual(aligned[0].align, ['left', 'center', 'right']);
assert.equal(aligned[0].headers.length, 3);
assert.equal(aligned[0].rows.length, 1);

const malformed = parseMarkdown('| A | B |\n| --- |');
assert.equal(malformed[0].type, 'paragraph');

const noBody = parseMarkdown('| A | B |\n| --- | --- |');
assert.equal(noBody[0].type, 'table');
assert.equal(noBody[0].rows.length, 0);

console.log('test-chat-markdown-tables: ok');
