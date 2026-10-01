import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
const html = await readFile(new URL('public/index.html', root), 'utf8');
assert.ok(source.includes('Object.freeze'));
assert.ok(source.includes('stableJson'));
assert.ok(source.includes('formatBytes'));
// The Ctrl/⌘ + Shift + Y shortcut is announced on the control it focuses, so
// it is discoverable without reading the README.
assert.ok(source.includes('Ctrl / ⌘ + Shift + Y'), 'the shortcut is shown in the UI');
assert.ok(source.includes("'aria-keyshortcuts', 'Control+Shift+Y Meta+Shift+Y'"), 'the shortcut is exposed to assistive tech');
assert.match(source, /event\.key\.toLowerCase\(\) !== 'y'/, 'the shortcut is actually handled');
assert.ok(html.includes('/workspace-backup.css'));
assert.ok(html.includes('/typed-build/workspace-backup.js'));
console.log('workspace-backup-regression: OK');
