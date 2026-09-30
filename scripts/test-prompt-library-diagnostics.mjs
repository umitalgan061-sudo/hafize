import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertDataAttributeDeclared } from './source-contract.mjs';

const source = fs.readFileSync('public/prompt-library-diagnostics.js', 'utf8');
for (const pattern of [
  /localStorage/, /normalizeItem/, /normalizeCollection/, /saveItems/,
  /prompt-library-diagnostics-report/, /aria-labelledby/, /aria-expanded/,
  /root\.confirm\?\./, /MAX_ORPHANS/
]) assert.match(source, pattern);
// The repair button carries `data-diagnostics-repair`; the module writes it
// through `dataset`, which is the same attribute.
assertDataAttributeDeclared(source, 'data-diagnostics-repair');
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /navigator\.sendBeacon/);
console.log('prompt diagnostics contract: ok');
