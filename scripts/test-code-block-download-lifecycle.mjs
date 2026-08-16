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
console.log('code block download lifecycle ok');
