import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/text-file-import.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');

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
  /Authorization/i,
  /Bearer\s+/i,
  /api[_-]?key/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/i
]) {
  assert.equal(forbidden.test(source), false, `text import must not expose forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("input.multiple = true"), true);
assert.equal(source.includes('const MAX_FILES = 4'), true);
assert.equal(source.includes('const MAX_FILE_BYTES = 128 * 1024'), true);
assert.equal(source.includes('const MAX_COMPOSER_CHARS = 12_000'), true);
assert.equal(source.includes('const MAX_PREVIEW_CHARS = 180'), true);

assert.equal(source.includes('staged = next;'), true, 'selection should stage locally');
assert.equal(source.includes('composerInput.value = next;'), true, 'explicit confirm should update composer');
assert.equal(source.indexOf('staged = next;') < source.indexOf('composerInput.value = next;'), true);
assert.equal(source.includes("review.querySelector?.('.text-file-import-confirm')?.addEventListener?.('click', confirmStaged)"), true);
assert.equal(source.includes("event?.key !== 'Escape'"), true);
assert.equal(source.includes("sendButton?.classList?.contains?.('streaming')"), true);
assert.equal(source.includes("showStatus('Yanıt sürerken dosya hazırlanamaz.'"), true);
assert.equal(source.includes('currentGeneration !== generation'), true, 'async reads must be invalidatable');

assert.equal(source.includes('preview.textContent = previewText(entry.text)'), true);
assert.equal(source.includes('name.textContent = entry.name'), true);
assert.equal(/\.innerHTML\s*=/.test(source), true, 'static review shell may use fixed innerHTML');
assert.equal(source.includes('entry.text}</'), false, 'file text must never be interpolated into HTML');

assert.equal(source.includes('clearStaged({ focusButton: true })'), true);
assert.equal(source.includes('generation += 1;'), true);
assert.equal(source.includes('staged = [];'), true);

console.log('text file import review boundary tests passed');
