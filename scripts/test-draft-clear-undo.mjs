import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/draft-clear-undo.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const swPolicy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

assert.equal(api.validDraft('hello'), 'hello');
assert.equal(api.validDraft('   '), null);
assert.equal(api.validDraft('x'.repeat(12_001)), null);
assert.equal(api.UNDO_WINDOW_MS, 10_000);

function node() {
  const listeners = new Map();
  return {
    id: '', className: '', type: '', textContent: '', value: '', hidden: false, disabled: false, children: [], parent: null, attrs: new Map(), focused: false, selection: null,
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; },
    setAttribute(k, v) { this.attrs.set(k, String(v)); },
    addEventListener(k, fn) { listeners.set(k, fn); },
    removeEventListener(k, fn) { if (listeners.get(k) === fn) listeners.delete(k); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); return true; },
    emit(k) { listeners.get(k)?.({ type: k }); },
    focus() { this.focused = true; },
    setSelectionRange(a, b) { this.selection = [a, b]; },
    querySelectorAll(selector) { return selector === 'button' ? this.children.filter((x) => x.type === 'button') : []; }
  };
}

const input = node(); input.id = 'messageInput';
const tools = node(); tools.className = 'composer-tools';
const head = node();
let control = null;
let style = null;
const documentRef = {
  head,
  createElement() { return node(); },
  querySelector(selector) {
    if (selector === '#messageInput') return input;
    if (selector === '.composer-tools') return tools;
    if (selector === '#draftClearUndo') return control;
    if (selector === '#hafize-draft-clear-undo-style') return style;
    return null;
  }
};
const toolsAppend = tools.append.bind(tools);
tools.append = (...items) => { toolsAppend(...items); control = items.find((x) => x.id === api.CONTROL_ID) || control; };
const headAppend = head.append.bind(head);
head.append = (...items) => { headAppend(...items); style = items.find((x) => x.id === api.STYLE_ID) || style; };
const timers = new Map();
let timerId = 0;
const setTimeoutImpl = (fn, delay) => { timerId += 1; timers.set(timerId, { fn, delay }); return timerId; };
const clearTimeoutImpl = (id) => timers.delete(id);
class EventImpl { constructor(type, init) { this.type = type; this.bubbles = init?.bubbles; } }

const controller = api.createController({ documentRef, EventImpl, setTimeoutImpl, clearTimeoutImpl });
assert.equal(controller.mount(), true);
const [clearButton, undoButton] = control.children;
assert.equal(clearButton.disabled, true);
assert.equal(undoButton.hidden, true);

input.value = 'Taslak metin'; input.emit('input');
assert.equal(clearButton.disabled, false);
clearButton.emit('click');
assert.equal(input.value, '');
assert.equal(undoButton.hidden, false);
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].delay, 10_000);
undoButton.emit('click');
assert.equal(input.value, 'Taslak metin');
assert.deepEqual(input.selection, [12, 12]);
assert.equal(undoButton.hidden, true);
assert.equal(timers.size, 0);

input.value = 'İkinci'; input.emit('input'); clearButton.emit('click');
input.value = 'Yeni yazı'; input.emit('input');
assert.equal(controller.undoClear(), false, 'undo never overwrites a new draft');
input.value = ''; input.emit('input');
[...timers.values()][0].fn();
assert.equal(controller.undoClear(), false, 'expired snapshot cannot restore');

assert.equal(controller.mount(), true);
assert.equal(tools.children.filter((x) => x.id === api.CONTROL_ID).length, 1);
assert.equal(controller.destroy(), true);
assert.equal(controller.destroy(), false);
assert.equal(api.createController({ documentRef: { querySelector: () => null }, setTimeoutImpl, clearTimeoutImpl }).mount(), false);

assert.match(loader, /HafizeDraftClearUndo/);
assert.match(loader, /\/draft-clear-undo\.js/);
assert.match(swPolicy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v26`/);
assert.match(swPolicy, /'\/draft-clear-undo\.js'/);
for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard', 'Authorization', 'Bearer ', 'innerHTML']) {
  assert.equal(source.includes(forbidden), false, `forbidden surface: ${forbidden}`);
}
console.log('draft clear undo tests passed');