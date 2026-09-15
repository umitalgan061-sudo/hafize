import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown.js', import.meta.url), 'utf8');
assert.ok(file.includes('HafizeMarkdown'));
assert.ok(file.includes('MAX_INPUT'));
assert.ok(file.includes('MAX_BLOCKS'));
assert.ok(file.includes('MAX_LINE'));
assert.ok(file.includes('safeUrl'));
assert.ok(file.includes("target = '_blank'"));
assert.ok(file.includes("rel = 'noopener noreferrer'"));
assert.ok(file.includes('textContent'));
assert.ok(file.includes('createElement'));
assert.ok(!file.includes('innerHTML'));
assert.ok(!file.includes('insertAdjacentHTML'));
assert.ok(!file.includes('document.write'));
console.log('message markdown source contract ok');
