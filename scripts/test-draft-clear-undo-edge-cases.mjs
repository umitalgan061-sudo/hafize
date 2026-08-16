import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/draft-clear-undo.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.validDraft('x'.repeat(12_000))?.length, 12_000, 'exact bound is allowed');
assert.equal(api.validDraft('x'.repeat(12_001)), null, 'over bound is rejected');
assert.equal(api.validDraft('\n  metin  \n'), '\n  metin  \n', 'draft whitespace is preserved');
assert.equal(api.validDraft('\n\t '), null, 'whitespace-only draft is rejected');

function makeNode() {
  const listeners = new Map();
  return {
    value: '', children: [], parent: null, hidden: false, disabled: false, type: '', id: '', className: '',
    append(...items) { items.forEach((item) => { item.parent = this; this.children.push(item); }); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); },
    setAttribute() {}, focus() {}, setSelectionRange() {},
    addEventListener(k, fn) { listeners.set(k, fn); },
    removeEventListener(k, fn) { if (listeners.get(k) === fn) listeners.delete(k); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
    emit(k) { listeners.get(k)?.({ type: k }); },
    querySelectorAll(selector) { return selector === 'button' ? this.children.filter((x) => x.type === 'button') : []; }
  };
}

const input = makeNode();
const tools = makeNode();
const head = makeNode();
let control = null;
const documentRef = {
  head,
  createElement: () => makeNode(),
  querySelector(selector) {
    if (selector === '#messageInput') return input;
    if (selector === '.composer-tools') return tools;
    if (selector === '#draftClearUndo') return control;
    return null;
  }
};
const append = tools.append.bind(tools);
tools.append = (...items) => { append(...items); control = items[0]; };
let nextTimer = 0;
const timers = new Map();
const setTimeoutImpl = (fn) => { nextTimer += 1; timers.set(nextTimer, fn); return nextTimer; };
const clearTimeoutImpl = (id) => timers.delete(id);
class EventImpl { constructor(type) { this.type = type; } }

const controller = api.createController({ documentRef, EventImpl, setTimeoutImpl, clearTimeoutImpl });
assert.equal(controller.mount(), true);
input.value = 'birinci'; input.emit('input'); controller.clearDraft();
assert.equal(timers.size, 1);
input.value = ''; input.emit('input'); controller.undoClear();
assert.equal(input.value, 'birinci');

input.value = 'ikinci'; input.emit('input'); controller.clearDraft();
input.value = 'üçüncü'; input.emit('input');
assert.equal(controller.undoClear(), false, 'new draft is never overwritten');
assert.equal(input.value, 'üçüncü');

controller.destroy();
assert.equal(timers.size, 0, 'destroy clears pending undo timer');
assert.equal(source.includes('requestSubmit'), false, 'clear/undo cannot submit');
assert.equal(source.includes('CustomEvent'), false, 'draft text is not emitted as custom payload');
console.log('draft clear undo edge-case tests passed');