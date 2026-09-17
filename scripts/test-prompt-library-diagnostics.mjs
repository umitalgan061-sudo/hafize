import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-diagnostics.js', 'utf8');

// The repair must ask through the host window's `confirm`, guarded by an
// optional call. Which binding holds that window — `root` or the injected
// `rootRef` — is not part of the contract.
for (const pattern of [
  /localStorage/, /normalizeItem/, /normalizeCollection/, /saveItems/,
  /prompt-library-diagnostics-report/, /aria-labelledby/, /aria-expanded/,
  /data-diagnostics-repair/, /\b(?:root|rootRef)\.confirm\?\./, /MAX_ORPHANS/
]) assert.match(source, pattern);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /navigator\.sendBeacon/);
console.log('prompt diagnostics contract: ok');
