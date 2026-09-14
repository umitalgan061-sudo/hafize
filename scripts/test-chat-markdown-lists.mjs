import assert from 'node:assert/strict';
import { parseMarkdown } from '../public/chat-markdown.js';

const unordered = parseMarkdown('* a\n+ b\n- c');
assert.equal(unordered[0].type, 'list');
assert.equal(unordered[0].ordered, false);
assert.equal(unordered[0].items.length, 3);

const ordered = parseMarkdown('12. a\n13. b');
assert.equal(ordered[0].type, 'list');
assert.equal(ordered[0].ordered, true);
assert.equal(ordered[0].start, 12);
assert.deepEqual(ordered[0].items.map((x) => x.spans[0].text), ['a', 'b']);

const split = parseMarkdown('1. a\n2. b\n\n- c');
assert.equal(split.length, 2);
assert.equal(split[0].ordered, true);
assert.equal(split[1].ordered, false);

const tasks = parseMarkdown('- [X] done\n- [x] done\n- [ ] todo');
assert.deepEqual(tasks[0].items.map((x) => [x.task, x.checked]), [[true, true], [true, true], [true, false]]);

const ordinaryBracket = parseMarkdown('- [not a task] text');
assert.equal(ordinaryBracket[0].items[0].task, false);

console.log('test-chat-markdown-lists: ok');
