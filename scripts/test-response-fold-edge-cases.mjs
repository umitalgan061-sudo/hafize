import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/response-fold.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.throws(() => api.createController({ documentRef: null }), /INVALID_RESPONSE_FOLD_DOCUMENT/);
assert.throws(() => api.createController({ documentRef: { querySelector() {} }, threshold: 0 }), /INVALID_RESPONSE_FOLD_THRESHOLD/);
assert.throws(() => api.createController({ documentRef: { querySelector() {} }, threshold: 2.2 }), /INVALID_RESPONSE_FOLD_THRESHOLD/);

const noMessages = api.createController({
  documentRef: {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    head: null
  },
  MutationObserverImpl: null
});
assert.equal(noMessages.mount(), false);
assert.deepEqual({ ...noMessages.snapshot() }, { mounted: false, threshold: 1800, decorated: 0 });

function classes(values = []) {
  const set = new Set(values);
  return { contains(value) { return set.has(value); } };
}

assert.equal(api.isAssistantArticle({ classList: classes(['assistant']) }), false);
assert.equal(api.isAssistantArticle({ classList: classes(['message']) }), false);
assert.equal(api.shouldFoldText(''), false);
assert.equal(api.shouldFoldText(undefined), false);
assert.equal(api.shouldFoldText('\u0000'.repeat(3000)), false);
assert.equal(api.shouldFoldText('a\r\n'.repeat(600)), false);
assert.equal(api.shouldFoldText('a'.repeat(api.MIN_COLLAPSE_CHARS + 500), Number.MAX_SAFE_INTEGER), false);

const sourceChecks = [
  ['network fetch', 'fetch('], ['XHR', 'XMLHttpRequest'], ['websocket', 'WebSocket'],
  ['beacon', 'sendBeacon'], ['local storage', 'localStorage'], ['session storage', 'sessionStorage'],
  ['cookie', 'document.cookie'], ['clipboard', 'navigator.clipboard'], ['form submit', 'requestSubmit'],
  ['tool API', '/api/']
];
for (const [label, token] of sourceChecks) assert.equal(source.includes(token), false, `${label} must stay absent`);

assert.match(source, /shouldDeferForStreaming/);
assert.match(source, /attributeFilter: \['class'\]/);
assert.match(source, /characterData: true/);
assert.match(source, /delete article\.dataset\[MARKER\]/);
assert.match(source, /observer\?\.disconnect/);
assert.match(source, /content\?\.classList\?\.remove/);

console.log('response fold edge cases ok');
