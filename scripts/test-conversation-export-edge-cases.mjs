import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-export.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

function message(role, value) {
  return {
    classList: { contains(name) { return name === role || name === 'message'; } },
    querySelector(selector) { return selector === '.content' ? { textContent: value } : null; }
  };
}

function messagesRoot(items) {
  return { querySelectorAll() { return items; } };
}

assert.equal(api.markdownEscapeHeading('a # b * c [d]'), 'a \\# b \\* c \\[d\\]');
assert.equal(api.markdownEscapeHeading('<b>'), '<b\\>');
assert.equal(api.filenameStem('CON'), 'CON');
assert.equal(api.filenameStem('başlık . . .'), 'başlık . .');
assert.equal(api.filenameStem('\u0000\n'), 'Hafize sohbeti');

const unknownRole = [{ role: 'tool', content: 'gizli' }];
assert.equal(api.markdownTranscript('x', unknownRole), null);
assert.equal(api.plainTextTranscript('x', unknownRole), null);
assert.equal(api.buildExport({ title: 'x', transcript: unknownRole, format: 'markdown' }), null);

const invalidContent = [{ role: 'user', content: 'x'.repeat(api.MAX_MESSAGE_CHARS + 1) }];
assert.equal(api.markdownTranscript('x', invalidContent), null);
assert.equal(api.plainTextTranscript('x', invalidContent), null);

const oversizedAggregate = [
  message('user', 'a'.repeat(api.MAX_MESSAGE_CHARS)),
  message('assistant', 'b'.repeat(api.MAX_MESSAGE_CHARS)),
  message('user', 'c'.repeat(api.MAX_MESSAGE_CHARS)),
  message('assistant', 'd'.repeat(api.MAX_MESSAGE_CHARS)),
  message('user', 'e')
];
assert.equal(api.collectTranscript(messagesRoot(oversizedAggregate)), null);

const malformedNodes = messagesRoot([
  { classList: { contains() { return false; } }, querySelector() { return null; } },
  message('user', 'korunur')
]);
const filtered = api.collectTranscript(malformedNodes);
assert.equal(filtered.length, 1);
assert.equal(filtered[0].content, 'korunur');

let anchorClicks = 0;
let appended = 0;
let removed = 0;
let revoked = [];
let createdBlob = null;

class BlobStub {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    createdBlob = this;
  }
}

const anchor = {
  href: '',
  download: '',
  rel: '',
  hidden: false,
  click() { anchorClicks += 1; },
  remove() { removed += 1; }
};
const root = messagesRoot([message('user', 'Soru'), message('assistant', 'Yanıt')]);
const documentRef = {
  body: { append(node) { assert.equal(node, anchor); appended += 1; } },
  querySelector(selector) {
    if (selector === '#messages') return root;
    if (selector === '.conversation-row.active .conversation-open') return { textContent: 'Güvenli / sohbet' };
    return null;
  },
  createElement(tag) {
    assert.equal(tag, 'a');
    return anchor;
  }
};
const urlApi = {
  createObjectURL(blob) {
    assert.equal(blob, createdBlob);
    return 'blob:hafize-test';
  },
  revokeObjectURL(value) { revoked.push(value); }
};
const timers = [];
const controller = api.createController({
  documentRef,
  BlobImpl: BlobStub,
  urlApi,
  setTimeoutImpl(fn, delay) { timers.push({ fn, delay }); return timers.length; },
  clearTimeoutImpl() {}
});

assert.equal(controller.download('markdown'), true);
assert.equal(anchorClicks, 1);
assert.equal(appended, 1);
assert.equal(removed, 1);
assert.deepEqual(revoked, ['blob:hafize-test']);
assert.equal(anchor.download, 'Güvenli - sohbet.md');
assert.equal(anchor.rel, 'noopener');
assert.equal(createdBlob.options.type, 'text/markdown;charset=utf-8');
assert.ok(createdBlob.parts[0].includes('## Sen'));
assert.ok(createdBlob.parts[0].includes('## Hafize'));
assert.ok(timers.some((entry) => entry.delay === 180));

anchorClicks = 0;
revoked = [];
assert.equal(controller.download('text'), true);
assert.equal(anchorClicks, 1);
assert.deepEqual(revoked, ['blob:hafize-test']);
assert.equal(anchor.download, 'Güvenli - sohbet.txt');
assert.equal(createdBlob.options.type, 'text/plain;charset=utf-8');
assert.ok(createdBlob.parts[0].includes('Sen:\nSoru'));
assert.ok(createdBlob.parts[0].includes('Hafize:\nYanıt'));

const unavailable = api.createController({
  documentRef,
  BlobImpl: undefined,
  urlApi: {},
  setTimeoutImpl() { return 1; },
  clearTimeoutImpl() {}
});
assert.equal(unavailable.download('markdown'), false);

const noMessagesDocument = {
  querySelector(selector) {
    if (selector === '#messages') return messagesRoot([]);
    return null;
  },
  createElement() { return anchor; }
};
const empty = api.createController({
  documentRef: noMessagesDocument,
  BlobImpl: BlobStub,
  urlApi,
  setTimeoutImpl() { return 1; },
  clearTimeoutImpl() {}
});
assert.equal(empty.download('markdown'), false);
assert.equal(empty.download('pdf'), false);

assert.throws(
  () => api.createController({ documentRef: null }),
  /INVALID_CONVERSATION_EXPORT_DOCUMENT/
);
assert.throws(
  () => api.createController({ documentRef, setTimeoutImpl: null }),
  /INVALID_CONVERSATION_EXPORT_TIMER/
);

console.log('conversation export edge cases ok');
