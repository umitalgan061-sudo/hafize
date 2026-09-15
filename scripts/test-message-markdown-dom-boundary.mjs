import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'public/message-markdown.js',
  'public/message-markdown-enhancement.js',
  'public/message-markdown-tools.js'
].map((path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = files.join('\n');
for (const forbidden of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function(']) {
  assert.equal(source.includes(forbidden), false, `forbidden DOM execution API: ${forbidden}`);
}
assert.ok(source.includes('createElement'));
assert.ok(source.includes('textContent'));
assert.ok(source.includes('replaceChildren'));
console.log('message markdown DOM boundary ok');
