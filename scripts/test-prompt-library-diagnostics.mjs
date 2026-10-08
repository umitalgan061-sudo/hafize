import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/typed/legacy/prompt-library-diagnostics.ts', 'utf8');
for (const pattern of [
  /localStorage/, /normalizeItem/, /normalizeCollection/, /saveItems/,
  /prompt-library-diagnostics-report/, /aria-labelledby/, /aria-expanded/,
  /dataset\.diagnosticsRepair/, /root\.confirm\?\./, /MAX_ORPHANS/
]) assert.match(source, pattern);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /navigator\.sendBeacon/);
console.log('prompt diagnostics contract: ok');
