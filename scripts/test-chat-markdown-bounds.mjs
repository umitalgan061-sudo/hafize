import assert from 'node:assert/strict';
import { LIMITS, parseMarkdown, scanInline } from '../public/chat-markdown.js';

const manyBlocks = Array.from({ length: LIMITS.maxBlocks + 50 }, (_, index) => `# ${index}`).join('\n\n');
const parsed = parseMarkdown(manyBlocks);
assert.ok(parsed.length <= LIMITS.maxBlocks);

const manyListItems = Array.from({ length: LIMITS.maxListItems + 20 }, (_, index) => `- ${index}`).join('\n');
assert.ok(parseMarkdown(manyListItems)[0].items.length <= LIMITS.maxListItems);

const manyRows = ['| A | B |', '| --- | --- |', ...Array.from({ length: LIMITS.maxTableRows + 20 }, (_, i) => `| ${i} | x |`)].join('\n');
assert.ok(parseMarkdown(manyRows)[0].rows.length <= LIMITS.maxTableRows);

const manyColumns = `| ${Array.from({ length: LIMITS.maxTableColumns + 8 }, (_, i) => i).join(' | ')} |\n| ${Array.from({ length: LIMITS.maxTableColumns + 8 }, () => '---').join(' | ')} |`;
assert.ok(parseMarkdown(manyColumns)[0].headers.length <= LIMITS.maxTableColumns);

const giantInput = parseMarkdown('a'.repeat(LIMITS.maxInput + 900));
assert.ok(giantInput.length <= LIMITS.maxBlocks);

const hugeInline = scanInline('**'.repeat(LIMITS.maxInline));
assert.equal(hugeInline[0].type, 'text');
assert.ok(hugeInline[0].text.length <= LIMITS.maxInline);

const hugeCode = parseMarkdown('```\n' + Array.from({ length: LIMITS.maxCodeLines + 20 }, () => 'x').join('\n'));
assert.ok(hugeCode[0].text.split('\n').length <= LIMITS.maxCodeLines);

console.log('test-chat-markdown-bounds: ok');
