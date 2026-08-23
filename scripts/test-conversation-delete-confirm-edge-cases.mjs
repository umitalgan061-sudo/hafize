import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-delete-confirm.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: { setTimeout, clearTimeout } });
const api = module.exports;

assert.equal(api.safeTitle(null), api.FALLBACK_TITLE);
assert.equal(api.safeTitle({ querySelector: () => null }), api.FALLBACK_TITLE);
assert.equal(api.shouldDeferToDraftGuard(null, { value: 'draft' }), false);
assert.equal(api.shouldDeferToDraftGuard({ closest: () => ({ classList: { contains: () => true } }) }, { value: '' }), false);

{
  const documentRef = {
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; }
  };
  assert.throws(() => api.createController({ documentRef, setTimeoutImpl: null }), /INVALID_CONVERSATION_DELETE_CONFIRM_TIMER/);
}

{
  assert.throws(() => api.createController({ documentRef: {} }), /INVALID_CONVERSATION_DELETE_CONFIRM_DOCUMENT/);
  assert.equal(api.mount({ documentRef: {} }), null);
}

{
  let capture = null;
  const documentRef = {
    addEventListener(type, fn, useCapture) { if (type === 'click' && useCapture) capture = fn; },
    removeEventListener() {},
    querySelector() { return { value: '' }; }
  };
  let called = 0;
  const controller = api.createController({ documentRef });
  controller.mount();
  const unrelated = { defaultPrevented: false, target: { closest: () => null } };
  assert.equal(capture(unrelated), false);
  assert.equal(called, 0);
  const prevented = { defaultPrevented: true, target: { closest: () => ({}) } };
  assert.equal(capture(prevented), false);
  assert.equal(called, 0);
}

assert.doesNotMatch(source, /innerHTML|outerHTML|eval\s*\(|Function\s*\(/);
assert.doesNotMatch(source, /Authorization|Bearer|api[_-]?key|secret/i);
assert.match(source, /const PENDING_TEXT = 'Sil\?'/);
assert.match(source, /const UNDO_TEXT = 'Geri al'/);

console.log('conversation delete confirmation edge-case tests passed');