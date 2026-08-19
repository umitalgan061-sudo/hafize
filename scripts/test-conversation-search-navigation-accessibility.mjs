import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-search-navigation.js', import.meta.url), 'utf8');

assert.match(source, /min-width:44px/);
assert.match(source, /min-height:44px/);
assert.match(source, /:focus-visible/);
assert.match(source, /forced-colors:active/);
assert.match(source, /aria-label', 'Önceki eşleşen sohbet'/);
assert.match(source, /aria-label', 'Sonraki eşleşen sohbet'/);
assert.match(source, /setAttribute\('role', 'status'\)/);
assert.match(source, /setAttribute\('aria-live', 'polite'\)/);
assert.match(source, /Alt\+↑|altKey/);
assert.doesNotMatch(source, /\.click\s*\(/);

console.log('conversation search navigation accessibility tests passed');
