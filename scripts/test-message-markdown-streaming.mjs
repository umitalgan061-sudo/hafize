import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown-enhancement.js', import.meta.url), 'utf8');
assert.ok(file.includes("characterData: true"));
assert.ok(file.includes('subtree: true'));
assert.ok(file.includes('MutationObserver'));
assert.ok(file.includes('data-markdown-source'));
assert.ok(file.includes('if (node.getAttribute(RENDERED) === source) return;'));
assert.ok(file.includes('node.replaceChildren(...rendered.childNodes)'));
assert.ok(file.includes('waitForRenderer'));
assert.ok(file.includes('retry >= 12'));
assert.ok(!file.includes('setInterval'));
assert.ok(!file.includes('fetch('));
assert.ok(!file.includes('WebSocket'));
console.log('message markdown streaming contract ok');
