import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-delete-confirm.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const policySource = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

function forbid(text, pattern, label) {
  assert.equal(pattern.test(text), false, `${label} must stay absent`);
}

assert.match(source, /CONFIRM_WINDOW_MS\s*=\s*8_000/);
assert.match(source, /CLEAR_HISTORY_PROMPT\s*=\s*'Tüm yerel sohbet geçmişi silinsin mi\?'/);
assert.match(source, /event\.stopImmediatePropagation\?\.\(\)/);
assert.match(source, /data-clear-history-pending/);
assert.match(source, /rootRef\.confirm\s*=\s*oneShotConfirm/);
assert.match(source, /rootRef\.confirm\s*=\s*originalConfirm/);
assert.match(source, /message === CLEAR_HISTORY_PROMPT/);
assert.match(source, /replayingClear\s*=\s*true/);
assert.match(source, /replayingClear\s*=\s*false/);
assert.match(source, /button\.click\(\)/);
assert.match(source, /documentRef\.visibilityState !== 'hidden'/);
assert.match(source, /event\?\.key !== 'Escape'/);

assert.match(source, /rootRef\?\.localStorage/, 'clear-history undo may use the existing bounded conversation store');
forbid(source, /sessionStorage|indexedDB/i, 'clear-intent alternate persistent storage');
forbid(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/i, 'clear-intent network');
forbid(source, /document\.cookie|authorization|bearer|credential|access[_-]?token|refresh[_-]?token/i, 'clear-intent secrets');
forbid(source, /innerHTML|outerHTML|insertAdjacentHTML|DOMParser/i, 'clear-intent HTML parsing');
forbid(source, /child_process|\bexec\s*\(|\bspawn\s*\(|shell\s*:\s*true/i, 'clear-intent shell execution');
forbid(source, /setInterval\s*\(/, 'unbounded recurring timers');

assert.match(appSource, /if \(!globalThis\.confirm\('Tüm yerel sohbet geçmişi silinsin mi\?'\)\) return;/,
  'app native confirm remains as a fallback and the enhancement only grants one exact call');
assert.match(appSource, /if \(isStreaming\) return showToast\('Yanıt sürerken geçmiş temizlenemez\.'\);/,
  'streaming guard remains authoritative in app.js');
assert.match(appSource, /conversations\s*=\s*\[\];/);
assert.match(appSource, /saveConversations\(\);/);

assert.match(policySource, /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}v\d+`/, 'PWA shell version must remain explicit');
assert.match(policySource, /'\/conversation-delete-confirm\.js'/);
assert.match(policySource, /pathname\.startsWith\('\/api\/'\)/,
  'API requests must remain network-only');

const publicApiBlock = source.slice(source.lastIndexOf('return Object.freeze({'));
for (const symbol of ['CLEAR_PENDING_TEXT', 'CLEAR_HISTORY_PROMPT', 'createController', 'mount']) {
  assert.ok(publicApiBlock.includes(symbol), `${symbol} must remain in the bounded public contract`);
}

assert.ok(source.indexOf('restorePending();') < source.indexOf('return replayApprovedClear(clearButton);'),
  'pending visual state must be cleared before the approved replay');
assert.ok(source.indexOf("rootRef.confirm = oneShotConfirm") < source.indexOf('button.click();'),
  'one-shot approval must be installed before the synchronous replay');
assert.ok(source.indexOf('button.click();') < source.lastIndexOf('rootRef.confirm = originalConfirm'),
  'native confirm must be restored after the synchronous replay');

console.log('clear history safety boundary tests passed');