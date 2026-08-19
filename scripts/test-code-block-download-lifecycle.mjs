import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-download.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

const appended = [];
const revoked = [];
let clicked = 0;
class FakeBlob {
  constructor(parts, options) { this.parts = parts; this.options = options; }
}
const URLImpl = {
  createObjectURL(blob) { assert.equal(blob.parts[0], 'const x = 1;'); return 'blob:test'; },
  revokeObjectURL(url) { revoked.push(url); }
};
const anchor = {
  href: '', download: '', rel: '', hidden: false,
  click() { clicked += 1; },
  remove() { this.removed = true; }
};
const documentRef = {
  body: { append(node) { appended.push(node); } },
  querySelector() { return null; },
  createElement(tag) {
    if (tag === 'a') return anchor;
    return { id: '', textContent: '', setAttribute() {} };
  }
};
const timers = [];
const controller = api.createController({
  documentRef, BlobImpl: FakeBlob, URLImpl,
  setTimeoutImpl(fn) { timers.push(fn); return timers.length; },
  clearTimeoutImpl() {}
});
const button = { disabled: false, dataset: {}, textContent: '' };
const code = { textContent: 'const x = 1;', dataset: { language: 'js' } };
assert.equal(controller.download(button, code), true);
assert.equal(clicked, 1);
assert.equal(appended[0], anchor);
assert.equal(anchor.download, 'hafize-code.js');
assert.equal(anchor.rel, 'noopener');
assert.equal(anchor.removed, true);
assert.deepEqual(revoked, ['blob:test']);
assert.equal(button.dataset.state, 'success');
assert.equal(button.textContent, 'İndirildi');

timers.at(-1)();
assert.equal(button.dataset.state, 'idle');
assert.equal(button.textContent, 'Kodu indir');

const noBlob = api.createController({ documentRef, BlobImpl: null, URLImpl, setTimeoutImpl() { return 1; }, clearTimeoutImpl() {} });
assert.equal(noBlob.download({ dataset: {} }, code), false);
const tooBig = { textContent: 'x'.repeat(api.MAX_CODE_CHARS + 1), dataset: { language: 'js' } };
assert.equal(controller.download({ dataset: {} }, tooBig), false);

const failedUrl = api.createController({
  documentRef, BlobImpl: FakeBlob,
  URLImpl: { createObjectURL() { throw new Error('no'); }, revokeObjectURL(url) { revoked.push(url); } },
  setTimeoutImpl() { return 1; }, clearTimeoutImpl() {}
});
assert.equal(failedUrl.download({ dataset: {} }, code), false);
assert.equal(revoked.includes(''), false);

function fakeNode() {
  const handlers = new Map();
  const children = [];
  return {
    dataset: {}, className: '', type: '', textContent: '', disabled: false, removed: false, parentNode: null,
    setAttribute() {},
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
    },
    removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
    append(...nodes) { for (const node of nodes) { children.push(node); node.parentNode = this; } },
    remove() { this.removed = true; },
    fire(type) { for (const handler of [...(handlers.get(type) || [])]) handler(); },
    handlerCount(type) { return handlers.get(type)?.size || 0; },
    get children() { return children; }
  };
}

const shell = fakeNode();
const pre = fakeNode();
const codeNode = fakeNode();
codeNode.textContent = 'const x = 1;';
codeNode.dataset.language = 'js';
pre.querySelector = (selector) => selector === ':scope > code' ? codeNode : null;
pre.closest = (selector) => selector === '.hafize-code-shell' ? shell : null;
const messages = { querySelectorAll() { return [pre]; } };
const head = fakeNode();
const lifecycleAnchors = [];
const lifecycleDocument = {
  head,
  body: { append(node) { lifecycleAnchors.push(node); } },
  querySelector(selector) { if (selector === '#messages') return messages; return null; },
  createElement(tag) {
    if (tag === 'a') return { href: '', download: '', rel: '', hidden: false, click() { clicked += 1; }, remove() {} };
    return fakeNode();
  }
};
let disconnected = false;
class Observer {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() { disconnected = true; }
}
const pending = new Set();
const cleared = [];
const lifecycle = api.createController({
  documentRef: lifecycleDocument, BlobImpl: FakeBlob, URLImpl,
  MutationObserverImpl: Observer,
  setTimeoutImpl(fn) { const token = { fn }; pending.add(token); return token; },
  clearTimeoutImpl(token) { pending.delete(token); cleared.push(token); }
});
assert.equal(lifecycle.mount(), true);
assert.equal(lifecycle.mount(), false);
assert.equal(pre.dataset[api.MARKER], '1');
const downloadButton = shell.children.find((node) => node.className === 'hafize-code-download');
assert.ok(downloadButton);
downloadButton.fire('click');
assert.ok(pending.size > 0);

lifecycle.destroy();
assert.equal(disconnected, true);
assert.equal(downloadButton.removed, true);
assert.equal(downloadButton.handlerCount('click'), 0);
assert.equal(pre.dataset[api.MARKER], undefined);
assert.equal(pending.size, 0);
assert.ok(cleared.length > 0);
const clickCount = clicked;
downloadButton.fire('click');
assert.equal(clicked, clickCount);
assert.equal(lifecycle.download(downloadButton, codeNode), false);
assert.equal(lifecycle.decorate(pre), false);
assert.equal(lifecycle.decorateAll(messages), 0);
lifecycle.destroy();

console.log('code block download lifecycle ok');
