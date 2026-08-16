import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/text-file-import.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.MAX_FILE_BYTES, 128 * 1024);
assert.equal(api.MAX_COMPOSER_CHARS, 12000);
assert.equal(api.safeFileName('../../secret.txt'), '..-..-secret.txt');
assert.equal(api.safeFileName('\u0000  demo   file.md  '), 'demo file.md');
assert.equal(api.safeFileName(''), 'metin-dosyasi.txt');
assert.equal(api.fileExtension('note.MD'), 'md');
assert.equal(api.fileExtension('.env.example'), 'env.example');
assert.equal(api.fileExtension('README'), '');

assert.equal(api.isAllowedFile({ name: 'note.txt', type: '', size: 10 }), true);
assert.equal(api.isAllowedFile({ name: 'code.py', type: 'application/octet-stream', size: 10 }), true);
assert.equal(api.isAllowedFile({ name: 'blob.bin', type: 'text/plain', size: 10 }), true);
assert.equal(api.isAllowedFile({ name: 'blob.bin', type: 'application/octet-stream', size: 10 }), false);
assert.equal(api.isAllowedFile({ name: 'huge.txt', type: 'text/plain', size: api.MAX_FILE_BYTES + 1 }), false);
assert.equal(api.isAllowedFile(null), false);

assert.equal(api.normalizeFileText('a\r\nb\rc\u0000d'), 'a\nb\ncd');
assert.equal(api.normalizeFileText(null), null);
assert.equal(api.formatImport('note.txt', 'hello'), '--- Dosya: note.txt ---\nhello\n--- Dosya sonu ---');
assert.equal(api.composeNextValue('', 'abc'), 'abc');
assert.equal(api.composeNextValue('draft', 'abc'), 'draft\n\nabc');
assert.equal(api.composeNextValue('x'.repeat(11999), 'ab'), null);

function createElement(tag) {
  const listeners = new Map();
  const attributes = new Map();
  return {
    tagName: tag.toUpperCase(),
    id: '',
    type: '',
    accept: '',
    hidden: false,
    tabIndex: 0,
    value: '',
    files: [],
    dataset: {},
    textContent: '',
    parentNode: null,
    clicked: 0,
    focused: 0,
    selection: null,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name); },
    append(node) { node.parentNode = this; },
    click() { this.clicked += 1; },
    focus() { this.focused += 1; },
    setSelectionRange(start, end) { this.selection = [start, end]; },
    dispatchEvent() { return true; },
    remove() { this.removed = true; },
    listener(name) { return listeners.get(name); }
  };
}

const body = createElement('body');
const tools = createElement('div');
const button = createElement('button');
button.id = 'attachBtn';
button.parentNode = tools;
const composer = createElement('textarea');
composer.id = 'messageInput';
const byId = new Map([['attachBtn', button], ['messageInput', composer]]);
const documentRef = {
  body,
  querySelector(selector) {
    if (selector.startsWith('#')) return byId.get(selector.slice(1)) || null;
    return null;
  },
  createElement(tag) {
    const node = createElement(tag);
    const originalAppend = body.append.bind(body);
    if (tag === 'input') {
      body.append = (child) => { originalAppend(child); if (child.id) byId.set(child.id, child); };
    }
    return node;
  }
};
const timers = [];
const controller = api.createController({
  documentRef,
  EventImpl: class { constructor(type) { this.type = type; } },
  setTimeoutImpl(fn) { timers.push(fn); return timers.length; },
  clearTimeoutImpl() {}
});
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), true);
assert.equal(button.getAttribute('aria-describedby'), api.STATUS_ID);
assert.match(button.getAttribute('title'), /metin|kod/);

const event = { currentTarget: button, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
assert.equal(controller.onAttachClick(event), true);
assert.equal(event.prevented, true);
assert.equal(event.stopped, true);

const ok = await controller.importFile({ name: 'sample.md', type: 'text/markdown', size: 5, async text() { return 'hello'; } });
assert.equal(ok, true);
assert.equal(composer.value, '--- Dosya: sample.md ---\nhello\n--- Dosya sonu ---');
assert.equal(composer.focused, 1);
assert.deepEqual(composer.selection, [composer.value.length, composer.value.length]);
assert.equal(controller.snapshot().mounted, true);
controller.destroy();
assert.equal(controller.snapshot().mounted, false);

assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('WebSocket'));
assert.ok(!source.includes('sendBeacon'));
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('requestSubmit'));
assert.ok(!source.includes('clipboard'));

console.log('text file import contract ok');
