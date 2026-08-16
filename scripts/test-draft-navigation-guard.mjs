import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/draft-navigation-guard.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.MAX_DRAFT_CHARS, 12000);
assert.equal(api.hasMeaningfulDraft(''), false);
assert.equal(api.hasMeaningfulDraft('   \n'), false);
assert.equal(api.hasMeaningfulDraft('merhaba'), true);
assert.equal(api.hasMeaningfulDraft('x'.repeat(12000)), true);
assert.equal(api.hasMeaningfulDraft('x'.repeat(12001)), false);

function targetFor(selector, active = false) {
  const row = { classList: { contains: (name) => active && name === 'active' } };
  const matched = {
    '#newChatBtn': selector === '#newChatBtn' ? {} : null,
    '#clearHistoryBtn': selector === '#clearHistoryBtn' ? {} : null,
    '.conversation-open': selector === '.conversation-open' ? {} : null,
    '.conversation-delete': selector === '.conversation-delete' ? { closest: () => row } : null
  };
  return { closest: (query) => matched[query] || null };
}

assert.equal(api.isConversationNavigationTarget(targetFor('#newChatBtn')), true);
assert.equal(api.isConversationNavigationTarget(targetFor('#clearHistoryBtn')), true);
assert.equal(api.isConversationNavigationTarget(targetFor('.conversation-open')), true);
assert.equal(api.isConversationNavigationTarget(targetFor('.conversation-delete', true)), true);
assert.equal(api.isConversationNavigationTarget(targetFor('.conversation-delete', false)), false);
assert.equal(api.isConversationNavigationTarget(targetFor('.other')), false);

function makeHarness(value = 'taslak') {
  const listeners = new Map();
  const status = {
    hidden: true,
    textContent: '',
    setAttribute() {},
    remove() { this.removed = true; }
  };
  const input = {
    value,
    focused: false,
    addEventListener(type, fn) { listeners.set(`input:${type}`, fn); },
    removeEventListener() {},
    focus() { this.focused = true; }
  };
  const composer = { append(node) { this.appended = node; } };
  const documentRef = {
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#composer') return composer;
      if (selector === `#${api.STATUS_ID}`) return null;
      return null;
    },
    createElement() { return status; },
    addEventListener(type, fn, capture) { listeners.set(`${type}:${capture}`, fn); },
    removeEventListener() {}
  };
  return { documentRef, input, status, listeners };
}

{
  const h = makeHarness('gönderilmemiş taslak');
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  const click = h.listeners.get('click:true');
  const event = {
    target: targetFor('.conversation-open'),
    defaultPrevented: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
  click(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(h.input.focused, true);
  assert.equal(h.status.hidden, false);
  assert.match(h.status.textContent, /Gönderilmemiş taslak/);
  h.input.value = '';
  h.listeners.get('input:input')();
  assert.equal(h.status.hidden, true);
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
}

{
  const h = makeHarness('');
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  const event = {
    target: targetFor('#newChatBtn'),
    defaultPrevented: false,
    prevented: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { throw new Error('must not stop'); }
  };
  h.listeners.get('click:true')(event);
  assert.equal(event.prevented, false);
}

assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|navigator\.clipboard|requestSubmit\s*\(/);
assert.match(source, /addEventListener\('click', onCaptureClick, true\)/);
assert.match(source, /stopImmediatePropagation/);

const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(loader, /HafizeDraftNavigationGuard/);
assert.match(loader, /\/draft-navigation-guard\.js/);
assert.match(sw, /\/draft-navigation-guard\.js/);
assert.match(sw, /hafize-shell-v27/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('draft navigation guard tests passed');
