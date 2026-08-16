import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-delete-confirm.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

function row(title = 'Sohbet', active = false) {
  return {
    classList: { contains: (name) => active && name === 'active' },
    querySelector: (selector) => selector === '.conversation-open' ? { textContent: title } : null
  };
}
function button(r) {
  return {
    focused: false,
    closest: (selector) => selector === '.conversation-row' ? r : selector === '.conversation-delete' ? null : null,
    focus() { this.focused = true; }
  };
}
function targetFor(btn) {
  return { closest: (selector) => selector === '.conversation-delete' ? btn : null };
}

assert.equal(api.safeTitle(row('  Proje   planı  ')), 'Proje planı');
assert.equal(api.safeTitle(row('   ')), api.FALLBACK_TITLE);
assert.equal(api.safeTitle(row('x'.repeat(200))).length, api.MAX_TITLE_CHARS);
assert.equal(api.shouldDeferToDraftGuard(button(row('A', true)), { value: 'taslak' }), true);
assert.equal(api.shouldDeferToDraftGuard(button(row('A', true)), { value: '   ' }), false);
assert.equal(api.shouldDeferToDraftGuard(button(row('A', false)), { value: 'taslak' }), false);

function harness({ approved = false, active = false, draft = '' } = {}) {
  const r = row('Deneme sohbeti', active);
  const btn = button(r);
  const listeners = new Map();
  const input = { value: draft };
  const prompts = [];
  const documentRef = {
    addEventListener(type, fn, capture) { listeners.set(`${type}:${capture}`, fn); },
    removeEventListener(type, fn, capture) { listeners.delete(`${type}:${capture}`); },
    querySelector(selector) { return selector === '#messageInput' ? input : null; }
  };
  const confirmImpl = (message) => { prompts.push(message); return approved; };
  return { r, btn, listeners, prompts, documentRef, confirmImpl };
}
function eventFor(btn) {
  return {
    target: targetFor(btn),
    defaultPrevented: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
}

{
  const h = harness({ approved: false });
  const controller = api.createController(h);
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), false);
  const event = eventFor(h.btn);
  assert.equal(h.listeners.get('click:true')(event), false);
  assert.equal(h.prompts.length, 1);
  assert.match(h.prompts[0], /Deneme sohbeti/);
  assert.match(h.prompts[0], /geri alınamaz/);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(h.btn.focused, true);
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
}

{
  const h = harness({ approved: true });
  const controller = api.createController(h);
  controller.mount();
  const event = eventFor(h.btn);
  assert.equal(h.listeners.get('click:true')(event), true);
  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
}

{
  const h = harness({ approved: false, active: true, draft: 'gönderilmemiş' });
  const controller = api.createController(h);
  controller.mount();
  const event = eventFor(h.btn);
  assert.equal(h.listeners.get('click:true')(event), false);
  assert.equal(h.prompts.length, 0, 'draft guard should get first chance to block active conversation deletion');
  assert.equal(event.prevented, false);
}

{
  const h = harness({ approved: false, active: false, draft: 'başka konuşmanın taslağı' });
  const controller = api.createController(h);
  controller.mount();
  const event = eventFor(h.btn);
  h.listeners.get('click:true')(event);
  assert.equal(h.prompts.length, 1, 'inactive conversation delete still needs confirmation');
}

assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|navigator\.clipboard|requestSubmit\s*\(/);
assert.doesNotMatch(source, /\.click\s*\(/);
assert.match(source, /addEventListener\('click', onCaptureClick, true\)/);

const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(loader, /HafizeConversationDeleteConfirm/);
assert.match(loader, /\/conversation-delete-confirm\.js/);
assert.match(sw, /\/conversation-delete-confirm\.js/);
assert.match(sw, /hafize-shell-v29/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('conversation delete confirmation tests passed');
