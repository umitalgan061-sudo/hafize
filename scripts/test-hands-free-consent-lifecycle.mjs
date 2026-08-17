import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');

assert.match(source, /let pending = false/);
assert.match(source, /let timeoutId = null/);
assert.match(source, /let bypass = false/);
assert.match(source, /let destroyed = false/);
assert.match(source, /function clearTimer\(\)/);
assert.match(source, /function expire\(\)/);
assert.match(source, /function cancel\(/);
assert.match(source, /function destroy\(\)/);
assert.match(source, /visibilitychange/);
assert.match(source, /keydown/);
assert.match(source, /Escape/);
assert.match(source, /removeEventListener/);
assert.match(source, /review\.panel\.remove\?\.\(\)/);

// Pending approval must be memory-only and bounded.
assert.doesNotMatch(source, /Storage|persist|serialize|JSON\.stringify/);
assert.doesNotMatch(source, /setInterval|requestAnimationFrame/);
assert.equal((source.match(/setTimeout/g) || []).length, 2);

// Confirmation handoff is synchronous and guarded by a one-shot bypass flag.
assert.match(source, /bypass = true;[\s\S]*toggle\.click\?\.\(\);[\s\S]*bypass = false;/);
assert.doesNotMatch(source, /await[\s\S]*toggle\.click/);

// Once active, the capture layer must allow the existing one-click disable path.
assert.match(source, /getAttribute\?\.\('aria-pressed'\) === 'true'/);

console.log('hands-free consent lifecycle tests passed');
