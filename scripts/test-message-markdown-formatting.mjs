import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown.js', import.meta.url), 'utf8');
const contracts = [
  ['heading', '/^#{1,3}\\\\s+/'],
  ['unordered list', '/^[-*+]\\\\s+/'],
  ['ordered list', '/^\\\\d+[.)]\\\\s+/'],
  ['fenced code', '/^\\\\s*```/'],
  ['blockquote', '/^\\\\s*>\\\\s?/'],
  ['horizontal rule', '/^\\\\s*---+\\\\s*$/'],
  ['inline code', "input[i] === '`'"],
  ['bold', "input.startsWith('**', i)"],
  ['emphasis', "input[i] === '*' || input[i] === '_'"],
  ['links', "input[i] === '['"]
];
for (const [name, token] of contracts) assert.ok(file.includes(token), `${name} parser contract missing`);
assert.ok(file.includes("doc.createElement(`h${level}`)"));
assert.ok(file.includes("doc.createElement('ul')"));
assert.ok(file.includes("doc.createElement('ol')"));
assert.ok(file.includes("doc.createElement('pre')"));
assert.ok(file.includes("doc.createElement('blockquote')"));
assert.ok(file.includes("doc.createElement('hr')"));
console.log('message markdown formatting contract ok');
