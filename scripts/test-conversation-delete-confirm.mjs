import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-delete-confirm.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

function classList(active = false) {
  const values = new Set(active ? ['active'] : []);
  return {
    contains: (name) => values.has(name),
    add: (name) => values.add(name),
    remove: (name) => values.delete(name)
  };
}
function row(title = 'Sohbet', active = false) {
  return {
    classList: classList(active),
    querySelector: (selector) => selector === '.conversation-open' ? { textContent: title } : null
  };
}
function button(r) {
  const attrs = new Map([['aria-label', 'Sohbeti sil']]);
  return {
    textContent: '×',
    focused: false,
    attrs,
    closest: (selector) => selector === '.conversation-row' ? r : null,
    focus() { this.focused = true; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    removeAttribute(name) { attrs.delete(name); }
  };
}
function targetFor(btn) {
  return { closest: (selector) => selector === '.conversation-delete' ? btn : null };
}
function eventFor(btn) {
  return {
    target: targetFor(btn),
    key: null,
    defaultPrevented: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
}

assert.equal(api.safeTitle(row('  Proje   planı  ')), 'Proje planı');
assert.equal(api.safeTitle(row('   ')), api.FALLBACK_TITLE);
assert.equal(api.safeTitle(row('x'.repeat(200))).length, api.MAX_TITLE_CHARS);
assert.equal(api.CONFIRM_WINDOW_MS, 8_000);
assert.equal(api.PENDING_TEXT, 'Sil?');
assert.equal(api.shouldDeferToDraftGuard(button(row('A', true)), { value: 'taslak' }), true);
assert.equal(api.shouldDeferToDraftGuard(button(row('A', true)), { value: '   ' }), false);
assert.equal(api.shouldDeferToDraftGuard(button(row('A', false)), { value: 'taslak' }), false);

function harness({ active = false, draft = '' } = {}) {
  const r = row('Deneme sohbeti', active);
  const btn = button(r);
  const listeners = new Map();
  const input = { value: draft };
  const timers = new Map();
  let nextTimer = 1;
  const documentRef = {
    visibilityState: 'visible',
    addEventListener(type, fn, capture) { listeners.set(`${type}:${Boolean(capture)}`, fn); },
    removeEventListener(type, fn, capture) { listeners.delete(`${type}:${Boolean(capture)}`); },
    querySelector(selector) { return selector === '#messageInput' ? input : null; }
  };
  const setTimeoutImpl = (fn, ms) => {
    const id = nextTimer++;
    timers.set(id, { fn, ms });
    return id;
  };
  const clearTimeoutImpl = (id) => timers.delete(id);
  return { r, btn, listeners, input, timers, documentRef, setTimeoutImpl, clearTimeoutImpl };
}

{
  const h = harness();
  const controller = api.createController(h);
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), false);

  const first = eventFor(h.btn);
  assert.equal(h.listeners.get('click:true')(first), false);
  assert.equal(first.prevented, true);
  assert.equal(first.stopped, true);
  assert.equal(h.btn.textContent, 'Sil?');
  assert.equal(h.btn.getAttribute('data-delete-pending'), 'true');
  assert.equal(h.btn.getAttribute('aria-pressed'), 'true');
  assert.match(h.btn.getAttribute('aria-label'), /Deneme sohbeti/);
  assert.equal(h.btn.focused, true);
  assert.equal(controller.snapshot().pending, true);
  assert.equal([...h.timers.values()][0].ms, api.CONFIRM_WINDOW_MS);

  const second = eventFor(h.btn);
  assert.equal(h.listeners.get('click:true')(second), true, 'second explicit click may reach app delete handler');
  assert.equal(second.prevented, false);
  assert.equal(second.stopped, false);
  assert.equal(h.btn.textContent, '×');
  assert.equal(h.btn.getAttribute('data-delete-pending'), null);
  assert.equal(h.btn.getAttribute('aria-pressed'), 'false');
  assert.equal(controller.snapshot().pending, false);

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
}

{
  const h = harness();
  const controller = api.createController(h);
  controller.mount();
  h.listeners.get('click:true')(eventFor(h.btn));
  const timer = [...h.timers.values()][0];
  timer.fn();
  assert.equal(controller.snapshot().pending, false);
  assert.equal(h.btn.textContent, '×');
}

{
  const h = harness();
  const controller = api.createController(h);
  controller.mount();
  h.listeners.get('click:true')(eventFor(h.btn));
  const escape = { key: 'Escape', prevented: false, preventDefault() { this.prevented = true; } };
  assert.equal(h.listeners.get('keydown:true')(escape), true);
  assert.equal(escape.prevented, true);
  assert.equal(controller.snapshot().pending, false);
  assert.equal(h.btn.focused, true);
}

{
  const h = harness();
  const controller = api.createController(h);
  controller.mount();
  h.listeners.get('click:true')(eventFor(h.btn));
  assert.equal(h.listeners.get('focusin:true')({ target: {} }), true);
  assert.equal(controller.snapshot().pending, false, 'moving focus away cancels destructive intent');
}

{
  const h = harness();
  const controller = api.createController(h);
  controller.mount();
  h.listeners.get('click:true')(eventFor(h.btn));
  h.documentRef.visibilityState = 'hidden';
  h.listeners.get('visibilitychange:false')();
  assert.equal(controller.snapshot().pending, false, 'backgrounding the page cancels destructive intent');
}

{
  const h = harness({ active: true, draft: 'gönderilmemiş' });
  const controller = api.createController(h);
  controller.mount();
  const event = eventFor(h.btn);
  assert.equal(h.listeners.get('click:true')(event), false);
  assert.equal(event.prevented, false, 'draft navigation guard keeps first chance to protect active draft');
  assert.equal(controller.snapshot().pending, false);
}

{
  const h = harness();
  const controller = api.createController(h);
  controller.mount();
  h.listeners.get('click:true')(eventFor(h.btn));
  const outside = { target: { closest: () => null }, defaultPrevented: false };
  h.listeners.get('click:true')(outside);
  assert.equal(controller.snapshot().pending, false, 'outside click cancels pending delete');
}

assert.doesNotMatch(source, /confirm\s*\(/, 'native blocking confirm must no longer control conversation deletion');
assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|navigator\.clipboard|requestSubmit\s*\(/);
assert.doesNotMatch(source, /\.click\s*\(/);
assert.match(source, /addEventListener\('click', onCaptureClick, true\)/);
assert.match(source, /addEventListener\('keydown', onKeydown, true\)/);
assert.match(source, /visibilitychange/);

const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(loader, /HafizeConversationDeleteConfirm/);
assert.match(loader, /\/conversation-delete-confirm\.js/);
assert.match(sw, /\/conversation-delete-confirm\.js/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('conversation delete two-step confirmation tests passed');