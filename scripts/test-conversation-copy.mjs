import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-copy.js');

function article(role, text, extras = {}) {
  return {
    classList: { contains: (name) => name === 'message' || name === role },
    querySelector(selector) {
      if (selector === '.content') return { textContent: text };
      return extras[selector] || null;
    }
  };
}

assert.equal(api.normalizeMessageText(''), null);
assert.equal(api.normalizeMessageText('   '), null);
assert.equal(api.normalizeMessageText('a\r\nb'), 'a\nb');
assert.equal(api.transcriptFromMessages([]), null);
assert.equal(
  api.transcriptFromMessages([article('user', 'Merhaba'), article('assistant', 'Selam')]),
  'Sen:\nMerhaba\n\nHafize:\nSelam'
);
assert.equal(
  api.transcriptFromMessages([article('assistant', 'Yanıt', { '.tool-activities': { textContent: 'secret tool trace' } })]),
  'Hafize:\nYanıt'
);
assert.equal(api.transcriptFromMessages([article('user', 'x'.repeat(api.MAX_COPY_CHARS))]), null);

const writes = [];
const messages = {
  querySelectorAll: () => [article('user', 'Soru'), article('assistant', 'Cevap')]
};
const host = { append(node) { this.child = node; } };
const button = {
  dataset: {}, hidden: false, disabled: false, textContent: '',
  setAttribute() {}, addEventListener(type, fn) { if (type === 'click') this.clickHandler = fn; }, remove() {}
};
const documentRef = {
  querySelector(selector) {
    if (selector === '#messages') return messages;
    if (selector === '.history-head') return host;
    return null;
  },
  createElement(tag) {
    assert.equal(tag, 'button');
    return button;
  }
};
const controller = api.createController({
  documentRef,
  clipboard: { async writeText(value) { writes.push(value); } },
  secureContext: true,
  MutationObserverImpl: null,
  setTimeoutImpl: () => 1,
  clearTimeoutImpl: () => {}
});
assert.equal(controller.mount(), true);
assert.equal(button.hidden, false);
assert.equal(await controller.copyConversation(), true);
assert.deepEqual(writes, ['Sen:\nSoru\n\nHafize:\nCevap']);
controller.destroy();

const blocked = api.createController({
  documentRef,
  clipboard: { async writeText() { throw new Error('should not write'); } },
  secureContext: false,
  MutationObserverImpl: null,
  setTimeoutImpl: () => 1,
  clearTimeoutImpl: () => {}
});
assert.equal(blocked.mount(), true);
assert.equal(await blocked.copyConversation(), false);
blocked.destroy();

const source = fs.readFileSync(path.resolve('public/conversation-copy.js'), 'utf8');
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'document.cookie', '.tool-activities', 'trace_id']) {
  assert.equal(source.includes(forbidden), false, `forbidden source token: ${forbidden}`);
}
assert.match(source, /clipboard\.writeText\(transcript\)/);
assert.match(source, /secureContext/);
assert.match(source, /\.content/);

const loader = fs.readFileSync(path.resolve('public/chat-run-controller.js'), 'utf8');
assert.match(loader, /HafizeConversationCopy/);
assert.match(loader, /\/conversation-copy\.js/);
const sw = fs.readFileSync(path.resolve('public/sw-policy.js'), 'utf8');
assert.match(sw, /hafize-shell-v32/);
assert.match(sw, /'\/conversation-copy\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('conversation copy tests passed');
