import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const handsFree = await readFile(new URL('../public/hands-free.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

for (const forbidden of [
  'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'navigator.clipboard',
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'innerHTML',
  'child_process', 'exec(', 'spawn(', 'shell=True'
]) {
  assert.equal(source.includes(forbidden), false, `consent layer must not use ${forbidden}`);
}

assert.match(source, /addEventListener\?\.\('click', onToggleCapture, true\)/);
assert.match(source, /preventDefault\?\.\(\)/);
assert.match(source, /stopImmediatePropagation\?\.\(\)/);
assert.match(source, /CONSENT_TIMEOUT_MS = 15_000/);
assert.match(source, /documentRef\.hidden/);
assert.match(source, /aria-describedby/);
assert.match(source, /Onayla ve dinlemeyi aç/);
assert.match(source, /konuşman otomatik gönderilmez/);

const consentIndex = index.indexOf('/hands-free-consent.js');
const handsFreeIndex = index.indexOf('/hands-free.js');
assert.ok(consentIndex >= 0 && handsFreeIndex >= 0 && consentIndex < handsFreeIndex, 'capture consent must load before hands-free runtime');
assert.match(index, /hands-free-consent\.css/);

assert.match(handsFree, /SESSION_LIMIT_MS = 30 \* 60 \* 1000/);
assert.match(handsFree, /DEFAULT_WAKE_PHRASE = 'hafize'/);
assert.match(handsFree, /input\.disabled/);
assert.match(handsFree, /documentRef\.hidden/);
assert.match(handsFree, /voiceOutputSpeaking/);
assert.match(handsFree, /voiceInputListening/);
assert.doesNotMatch(handsFree, /requestSubmit\(/);

console.log('hands-free consent security tests passed');
