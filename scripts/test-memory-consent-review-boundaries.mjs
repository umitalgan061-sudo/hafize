import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/memory-consent-review.js', import.meta.url));
const memoryPath = fileURLToPath(new URL('../public/memory-ui.js', import.meta.url));
const [source, memoryUi] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(memoryPath, 'utf8')
]);

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /indexedDB/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /innerHTML/,
  /outerHTML/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/i,
  /Authorization/i,
  /Bearer\s+/i,
  /HAFIZE_.*(?:TOKEN|SECRET|KEY)/
]) {
  assert.equal(forbidden.test(source), false, `consent enhancement exposes forbidden surface: ${forbidden}`);
}

assert.match(source, /addEventListener\('submit', onSubmitCapture, true\)/);
assert.match(source, /event\.stopImmediatePropagation/);
assert.match(source, /bypassWriteOnce = true/);
assert.match(source, /form\.requestSubmit\?\.\(\)/);
assert.match(source, /DELETE_CONFIRM_MS = 8000/);
assert.match(source, /results\.addEventListener\('click', onDeleteCapture, true\)/);
assert.match(source, /pendingDeleteButton === button/);
assert.match(source, /event\?\.key !== 'Escape'/);
assert.match(source, /preview\.textContent = snapshot\.preview/);
assert.match(source, /meta\.textContent =/);

assert.match(memoryUi, /explicitUserIntent:\s*true/);
assert.match(memoryUi, /sourceType:\s*'user_note'/);
assert.match(memoryUi, /sensitivity:\s*'personal'/);
assert.match(memoryUi, /method:\s*'POST'/);
assert.match(memoryUi, /method:\s*'DELETE'/);
assert.match(memoryUi, /exactMatch:\s*true/);

assert.equal(source.includes('memoryContent.value ='), false, 'consent layer must not rewrite memory content');
assert.equal(source.includes('/api/memory'), false, 'consent layer must reuse existing memory client instead of opening a second API path');

console.log('memory consent boundary tests passed');
