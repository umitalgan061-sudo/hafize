// Defense-in-depth source contract for the chat Markdown surface.
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const path of ['public/markdown-renderer.ts', 'public/chat-markdown.js']) {
  const source = fs.readFileSync(path, 'utf8');
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /insertAdjacentHTML/);
  assert.doesNotMatch(source, /new Function/);
  assert.doesNotMatch(source, /eval\s*\(/);
  assert.doesNotMatch(source, /fetch\s*\(/);
}

const renderer = fs.readFileSync('public/markdown-renderer.ts', 'utf8');
assert.match(renderer, /createElement/);
assert.match(renderer, /createTextNode/);
assert.match(renderer, /textContent/);
assert.match(renderer, /https?:/);
assert.match(renderer, /mailto:/);

console.log('chat markdown security contract: ok');
