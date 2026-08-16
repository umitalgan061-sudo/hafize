import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/text-file-import.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.isAllowedFile({ name: 'x.txt', type: 'text/plain', size: -1 }), false);
assert.equal(api.isAllowedFile({ name: 'x.txt', type: 'text/plain', size: Number.NaN }), false);
assert.equal(api.isAllowedFile({ name: 'x', type: 'text/plain', size: 1 }), true);
assert.equal(api.isAllowedFile({ name: 'x.weird', type: 'text/x-custom', size: 1 }), true);
assert.equal(api.isAllowedFile({ name: 'x.exe', type: 'application/x-msdownload', size: 1 }), false);
assert.equal(api.formatImport('bad\nname.txt', 'a\u0000b'), '--- Dosya: bad name.txt ---\nab\n--- Dosya sonu ---');
assert.equal(api.composeNextValue('x'.repeat(api.MAX_COMPOSER_CHARS), 'a'), null);
assert.equal(api.composeNextValue('', ''), null);
assert.equal(api.composeNextValue(null, 'x'), null);

function node() {
  const listeners = new Map();
  const attrs = new Map();
  return {
    value: '', files: [], hidden: false, dataset: {}, parentNode: null, textContent: '',
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
    append(child) { child.parentNode = this; },
    remove() { this.removed = true; },
    focus() {},
    dispatchEvent() {},
    setSelectionRange() {},
    click() {},
    listener(type) { return listeners.get(type); }
  };
}

function harness({ composerValue = '' } = {}) {
  const body = node();
  const parent = node();
  const button = node();
  const composer = node();
  composer.value = composerValue;
  button.parentNode = parent;
  const map = new Map([['attachBtn', button], ['messageInput', composer]]);
  const created = [];
  const documentRef = {
    body,
    querySelector(selector) { return selector.startsWith('#') ? map.get(selector.slice(1)) || null : null; },
    createElement() {
      const item = node();
      created.push(item);
      return item;
    }
  };
  body.append = (child) => { child.parentNode = body; if (child.id) map.set(child.id, child); };
  parent.append = (child) => { child.parentNode = parent; if (child.id) map.set(child.id, child); };
  const pending = new Map();
  let timer = 0;
  const controller = api.createController({
    documentRef,
    EventImpl: class {},
    setTimeoutImpl(fn) { timer += 1; pending.set(timer, fn); return timer; },
    clearTimeoutImpl(id) { pending.delete(id); }
  });
  return { controller, composer, button, created, pending, map };
}

{
  const { controller } = harness();
  assert.equal(controller.mount(), true);
  assert.equal(await controller.importFile({ name: 'bad.exe', type: 'application/octet-stream', size: 10, async text() { throw new Error('must not read'); } }), false);
  controller.destroy();
}

{
  const { controller } = harness();
  assert.equal(controller.mount(), true);
  assert.equal(await controller.importFile({ name: 'huge.txt', type: 'text/plain', size: api.MAX_FILE_BYTES + 1, async text() { return 'x'; } }), false);
  controller.destroy();
}

{
  const { controller } = harness({ composerValue: 'x'.repeat(11980) });
  assert.equal(controller.mount(), true);
  assert.equal(await controller.importFile({ name: 'note.txt', type: 'text/plain', size: 3, async text() { return 'abc'; } }), false);
  controller.destroy();
}

{
  const { controller } = harness();
  assert.equal(controller.mount(), true);
  assert.equal(await controller.importFile({ name: 'note.txt', type: 'text/plain', size: 3, async text() { throw new Error('denied'); } }), false);
  controller.destroy();
}

{
  const { controller } = harness();
  assert.equal(controller.mount(), true);
  assert.equal(await controller.importFile({ name: 'note.txt', type: 'text/plain', size: 3 }), false);
  controller.destroy();
}

assert.throws(() => api.createController({ documentRef: {} }), /INVALID_TEXT_FILE_IMPORT_DOCUMENT/);
assert.throws(() => api.createController({ documentRef: { querySelector() {}, createElement() {} }, setTimeoutImpl: null, clearTimeoutImpl() {} }), /INVALID_TEXT_FILE_IMPORT_TIMER/);

console.log('text file import edge cases ok');
