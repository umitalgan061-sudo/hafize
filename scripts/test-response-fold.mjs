import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/response-fold.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.MIN_COLLAPSE_CHARS, 1800);
assert.equal(api.normalizedText(null), '');
assert.equal(api.normalizedText('a\r\nb\rc\u0000d'), 'a\nb\ncd');
assert.equal(api.shouldFoldText('x'.repeat(1799)), false);
assert.equal(api.shouldFoldText('x'.repeat(1800)), true);
assert.equal(api.shouldFoldText('x'.repeat(10), 10), true);
assert.equal(api.shouldFoldText('x'.repeat(10), 11), false);
assert.equal(api.shouldFoldText('x', 0), false);
assert.equal(api.shouldFoldText('x', 1.5), false);

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(...items) { for (const item of items) values.add(item); },
    remove(...items) { for (const item of items) values.delete(item); },
    contains(item) { return values.has(item); },
    toggle(item, force) {
      if (force) values.add(item); else values.delete(item);
      return Boolean(force);
    }
  };
}

function control() {
  const attrs = new Map();
  return {
    textContent: '',
    title: '',
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); }
  };
}

const content = { classList: classList() };
const button = control();
assert.equal(api.setExpanded(content, button, false), true);
assert.equal(content.classList.contains(api.CONTENT_CLASS), true);
assert.equal(content.classList.contains(api.COLLAPSED_CLASS), true);
assert.equal(button.getAttribute('aria-expanded'), 'false');
assert.equal(button.textContent, 'Devamını göster');
assert.match(button.title, /tamamını/);

assert.equal(api.setExpanded(content, button, true), true);
assert.equal(content.classList.contains(api.COLLAPSED_CLASS), false);
assert.equal(button.getAttribute('aria-expanded'), 'true');
assert.equal(button.textContent, 'Daralt');
assert.match(button.title, /daralt/);
assert.equal(api.setExpanded(null, button, true), false);
assert.equal(api.setExpanded(content, null, true), false);

const assistant = { classList: classList(['message', 'assistant']) };
const user = { classList: classList(['message', 'user']) };
assert.equal(api.isAssistantArticle(assistant), true);
assert.equal(api.isAssistantArticle(user), false);
assert.equal(api.isAssistantArticle(null), false);

const first = {};
const second = {};
const messages = { querySelectorAll(selector) { return selector === '.message.assistant' ? [first, second] : []; } };
assert.equal(api.lastAssistant(messages), second);
assert.equal(api.lastAssistant({ querySelectorAll() { return []; } }), null);
assert.equal(api.shouldDeferForStreaming(second, messages, { classList: classList(['streaming']) }), true);
assert.equal(api.shouldDeferForStreaming(first, messages, { classList: classList(['streaming']) }), false);
assert.equal(api.shouldDeferForStreaming(second, messages, { classList: classList() }), false);

assert.match(source, /aria-expanded/);
assert.match(source, /aria-controls/);
assert.match(source, /prefers-reduced-motion/);
assert.ok(!source.includes('innerHTML'));
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('WebSocket'));
assert.ok(!source.includes('requestSubmit'));
assert.ok(!source.includes('clipboard'));

console.log('response fold core contract ok');
