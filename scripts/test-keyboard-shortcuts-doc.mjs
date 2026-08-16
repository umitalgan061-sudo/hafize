import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [docs, source] = await Promise.all([
  readFile(fileURLToPath(new URL('../docs/KEYBOARD_SHORTCUTS.md', import.meta.url)), 'utf8'),
  readFile(fileURLToPath(new URL('../public/keyboard-shortcuts.js', import.meta.url)), 'utf8')
]);

for (const contract of ['Ctrl+K', '⌘K', '`/`', '`Esc`', 'event.repeat', 'preventDefault()', 'network-only']) {
  assert.equal(docs.includes(contract), true, `keyboard shortcut docs must describe ${contract}`);
}
for (const boundary of ['fetch', 'localStorage', 'sessionStorage', 'clipboard', 'backend default-deny']) {
  assert.equal(docs.includes(boundary), true, `keyboard shortcut docs must preserve ${boundary} boundary`);
}
assert.equal(source.includes("focusComposer: 'mod+k'"), true);
assert.equal(source.includes("focusComposerSlash: '/'"), true);
assert.equal(source.includes("stopResponse: 'escape'"), true);

console.log('keyboard shortcut documentation contract tests passed');
