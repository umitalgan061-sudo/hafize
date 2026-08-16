import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/message-keyboard-nav.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, Array, Object, String, Boolean });
const api = module.exports;

assert.deepEqual(Array.from(api.SUPPORTED_KEYS), ['ArrowUp', 'ArrowDown', 'Home', 'End']);
assert.equal(api.nextIndex(1, 'ArrowUp', 3), 0);
assert.equal(api.nextIndex(1, 'ArrowDown', 3), 2);
assert.equal(api.nextIndex(1, 'Home', 3), 0);
assert.equal(api.nextIndex(1, 'End', 3), 2);
assert.equal(api.nextIndex(0, 'ArrowUp', 3), 0);
assert.equal(api.nextIndex(2, 'ArrowDown', 3), 2);
assert.equal(api.nextIndex(-1, 'ArrowDown', 3), -1);
assert.equal(api.nextIndex(0, 'x', 1), 0);

assert.equal(api.isInteractiveTarget({ tagName: 'BUTTON' }), true);
assert.equal(api.isInteractiveTarget({ tagName: 'div', isContentEditable: true }), true);
assert.equal(api.isInteractiveTarget({ tagName: 'div', closest() { return null; } }), false);

const visible = { hidden: false, getAttribute() { return null; } };
const hidden = { hidden: true, getAttribute() { return null; } };
const ariaHidden = { hidden: false, getAttribute(name) { return name === 'aria-hidden' ? 'true' : null; } };
assert.equal(api.visibleMessages({ querySelectorAll() { return [visible, hidden, ariaHidden]; } }).length, 1);

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'clipboard', 'requestSubmit(', '.submit(', 'eval(']) {
  assert.equal(source.includes(forbidden), false, `forbidden API found: ${forbidden}`);
}

console.log('message keyboard navigation tests passed');
