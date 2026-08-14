import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const shell = require('../public/ui-shell.js');

function fakeNode(id) {
  const listeners = new Map();
  const attrs = new Map();
  const classes = new Set();
  return {
    id,
    focused: false,
    classList: { contains: (value) => classes.has(value), toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); } },
    setAttribute(key, value) { attrs.set(key, value); },
    getAttribute(key) { return attrs.get(key); },
    removeAttribute(key) { attrs.delete(key); },
    focus() { this.focused = true; },
    addEventListener(type, listener, capture) { listeners.set(`${type}:${Boolean(capture)}`, listener); },
    removeEventListener(type, listener, capture) { if (listeners.get(`${type}:${Boolean(capture)}`) === listener) listeners.delete(`${type}:${Boolean(capture)}`); },
    fire(type, event = {}, capture = false) { listeners.get(`${type}:${Boolean(capture)}`)?.(event); }
  };
}

const sidebar = fakeNode('sidebar');
const toggle = fakeNode('sidebarToggle');
const listeners = new Map();
const documentRef = {
  querySelector(selector) { return selector === '#sidebar' ? sidebar : selector === '#sidebarToggle' ? toggle : null; },
  addEventListener(type, listener) { listeners.set(type, listener); },
  removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); }
};

const disclosure = shell.installSidebarDisclosure(documentRef);
assert.equal(disclosure.isOpen(), false);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(toggle.getAttribute('aria-controls'), 'sidebar');
assert.equal(toggle.getAttribute('aria-label'), 'Menüyü aç');
let stopped = false;
toggle.fire('click', { preventDefault() {}, stopImmediatePropagation() { stopped = true; } }, true);
assert.equal(stopped, true);
assert.equal(disclosure.isOpen(), true);
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
let prevented = false;
listeners.get('keydown')({ key: 'Escape', preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(disclosure.isOpen(), false);
assert.equal(toggle.focused, true);
disclosure.destroy();
assert.equal(listeners.has('keydown'), false);

const stage = fakeNode('stage');
const messages = fakeNode('messages');
stage.setAttribute('aria-live', 'polite');
const chatDocument = {
  querySelector(selector) { return selector === '.chat-stage' ? stage : selector === '#messages' ? messages : null; }
};
assert.equal(shell.installChatAccessibility(chatDocument), true);
assert.equal(stage.getAttribute('aria-live'), undefined);
assert.equal(messages.getAttribute('role'), 'log');
assert.equal(messages.getAttribute('aria-live'), 'polite');
assert.equal(messages.getAttribute('aria-relevant'), 'additions text');
assert.equal(messages.getAttribute('aria-atomic'), 'false');
assert.equal(messages.getAttribute('aria-label'), 'Sohbet mesajları');
assert.equal(shell.installChatAccessibility({ querySelector() { return null; } }), false);

assert.deepEqual(shell.moveCalendarDate(2026, 0, 1, 'ArrowLeft'), { year: 2025, month: 11, day: 31 });
assert.deepEqual(shell.moveCalendarDate(2026, 0, 31, 'ArrowRight'), { year: 2026, month: 1, day: 1 });
assert.deepEqual(shell.moveCalendarDate(2026, 1, 8, 'ArrowUp'), { year: 2026, month: 1, day: 1 });
assert.deepEqual(shell.moveCalendarDate(2026, 1, 22, 'ArrowDown'), { year: 2026, month: 2, day: 1 });
assert.deepEqual(shell.moveCalendarDate(2024, 1, 19, 'Home'), { year: 2024, month: 1, day: 1 });
assert.deepEqual(shell.moveCalendarDate(2024, 1, 19, 'End'), { year: 2024, month: 1, day: 29 });
assert.equal(shell.moveCalendarDate(2026, 0, 1, 'Enter'), null);

console.log('chat shell accessibility tests passed');
