import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-keyboard-nav.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.deepEqual(Array.from(api.SUPPORTED_KEYS), ['ArrowUp', 'ArrowDown', 'Home', 'End']);
assert.equal(api.nextIndex(1, 'ArrowUp', 4), 0);
assert.equal(api.nextIndex(1, 'ArrowDown', 4), 2);
assert.equal(api.nextIndex(0, 'ArrowUp', 4), 0);
assert.equal(api.nextIndex(3, 'ArrowDown', 4), 3);
assert.equal(api.nextIndex(2, 'Home', 4), 0);
assert.equal(api.nextIndex(1, 'End', 4), 3);
assert.equal(api.nextIndex(-1, 'End', 4), -1);
assert.equal(api.nextIndex(4, 'Home', 4), -1);
assert.equal(api.nextIndex(0, 'ArrowDown', 0), -1);

for (const tagName of ['INPUT', 'textarea', 'Select']) {
  assert.equal(api.isEditableTarget({ tagName }), true);
}
assert.equal(api.isEditableTarget({ tagName: 'BUTTON' }), false);
assert.equal(api.isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);

function makeButton(name, { rowHidden = false, hidden = false, disabled = false } = {}) {
  return {
    name,
    hidden,
    disabled,
    focused: false,
    scrolled: false,
    classList: { contains: (value) => value === 'conversation-open' },
    closest: (selector) => selector === '.conversation-row' ? { hidden: rowHidden } : null,
    focus(options) { this.focused = options?.preventScroll === true; },
    scrollIntoView(options) { this.scrolled = options?.block === 'nearest'; }
  };
}

{
  const a = makeButton('a');
  const hidden = makeButton('hidden', { rowHidden: true });
  const disabled = makeButton('disabled', { disabled: true });
  const b = makeButton('b');
  const result = api.visibleConversationButtons({ querySelectorAll: () => [a, hidden, disabled, b] });
  assert.deepEqual(Array.from(result, (item) => item.name), ['a', 'b']);
}

function makeHarness() {
  const buttons = [makeButton('a'), makeButton('b'), makeButton('c')];
  const listeners = new Map();
  const list = {
    querySelectorAll: () => buttons,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const documentRef = { querySelector: (selector) => selector === '#conversationList' ? list : null };
  return { buttons, listeners, documentRef };
}

function eventFor(target, key, extras = {}) {
  return {
    target,
    key,
    defaultPrevented: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    prevented: false,
    preventDefault() { this.prevented = true; },
    ...extras
  };
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), false);
  const keydown = h.listeners.get('keydown');

  const down = eventFor(h.buttons[0], 'ArrowDown');
  assert.equal(keydown(down), true);
  assert.equal(down.prevented, true);
  assert.equal(h.buttons[1].focused, true);
  assert.equal(h.buttons[1].scrolled, true);

  const end = eventFor(h.buttons[0], 'End');
  assert.equal(keydown(end), true);
  assert.equal(h.buttons[2].focused, true);

  const home = eventFor(h.buttons[2], 'Home');
  assert.equal(keydown(home), true);
  assert.equal(h.buttons[0].focused, true);

  const boundary = eventFor(h.buttons[0], 'ArrowUp');
  assert.equal(keydown(boundary), false);
  assert.equal(boundary.prevented, false);

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
}

{
  const h = makeHarness();
  const controller = api.createController({ documentRef: h.documentRef });
  controller.mount();
  const keydown = h.listeners.get('keydown');
  assert.equal(keydown(eventFor(h.buttons[0], 'ArrowDown', { ctrlKey: true })), false);
  assert.equal(keydown(eventFor(h.buttons[0], 'ArrowDown', { shiftKey: true })), false);
  assert.equal(keydown(eventFor(h.buttons[0], 'Enter')), false);
  assert.equal(keydown(eventFor({ tagName: 'INPUT', classList: { contains: () => true } }, 'ArrowDown')), false);
  assert.equal(keydown(eventFor(h.buttons[0], 'ArrowDown', { defaultPrevented: true })), false);
}

assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|navigator\.clipboard|requestSubmit\s*\(/);
assert.doesNotMatch(source, /\.click\s*\(/);
assert.match(source, /preventScroll: true/);
