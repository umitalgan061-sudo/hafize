import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/response-fold.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...items) { for (const item of items) values.add(item); },
    remove(...items) { for (const item of items) values.delete(item); },
    contains(item) { return values.has(item); },
    toggle(item, force) { if (force) values.add(item); else values.delete(item); return Boolean(force); }
  };
}

function makeButton() {
  const attrs = new Map();
  const handlers = new Map();
  return {
    type: '', className: '', textContent: '', title: '',
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
    addEventListener(name, handler) { handlers.set(name, handler); },
    click() { handlers.get('click')?.({ preventDefault() {} }); }
  };
}

function makeActions() {
  const children = [];
  return {
    className: '', removed: false,
    append(...nodes) { children.push(...nodes); },
    remove() { this.removed = true; },
    get children() { return children; }
  };
}

function makeArticle(text = 'x'.repeat(2000)) {
  const content = { id: '', textContent: text, classList: makeClassList() };
  const children = [];
  const dataset = {};
  const article = {
    dataset,
    classList: makeClassList(['message', 'assistant']),
    querySelector(selector) {
      if (selector === '.content') return content;
      if (selector === `.${api.ACTIONS_CLASS}`) return children.find((node) => node.className === api.ACTIONS_CLASS && !node.removed) || null;
      return null;
    },
    append(node) { children.push(node); }
  };
  return { article, content, children };
}

const short = makeArticle('kısa');
const long = makeArticle();
const assistantArticles = [short.article, long.article];
const messages = {
  querySelectorAll(selector) {
    if (selector === '.message.assistant') return assistantArticles;
    if (selector === `.${api.ACTIONS_CLASS}`) return long.children.filter((node) => node.className === api.ACTIONS_CLASS && !node.removed);
    if (selector.startsWith('.message.assistant[data-')) return assistantArticles.filter((article) => article.dataset[api.MARKER] === '1');
    return [];
  }
};
const sendButton = { classList: makeClassList() };
const styles = [];
const documentRef = {
  head: { append(node) { styles.push(node); } },
  querySelector(selector) {
    if (selector === '#messages') return messages;
    if (selector === '#sendBtn') return sendButton;
    if (selector === `#${api.STYLE_ID}`) return styles.find((node) => node.id === api.STYLE_ID) || null;
    return null;
  },
  createElement(tag) {
    if (tag === 'button') return makeButton();
    if (tag === 'div') return makeActions();
    if (tag === 'style') return { id: '', textContent: '' };
    throw new Error(`unexpected tag ${tag}`);
  }
};

const observations = [];
let disconnected = false;
class FakeObserver {
  constructor(callback) { this.callback = callback; }
  observe(target, options) { observations.push({ target, options }); }
  disconnect() { disconnected = true; }
}

const controller = api.createController({ documentRef, MutationObserverImpl: FakeObserver });
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), true);
assert.equal(styles.length, 1);
assert.equal(long.article.dataset[api.MARKER], '1');
assert.equal(short.article.dataset[api.MARKER], undefined);
assert.equal(long.children.length, 1);
assert.equal(long.content.classList.contains(api.CONTENT_CLASS), true);
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), true);
assert.match(long.content.id, /^hafize-response-fold-\d+$/);

const action = long.children[0];
const toggle = action.children[0];
assert.equal(toggle.getAttribute('aria-controls'), long.content.id);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.match(toggle.getAttribute('aria-label'), /Hafize/);
assert.equal(toggle.textContent, 'Devamını göster');
toggle.click();
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
assert.equal(toggle.textContent, 'Daralt');
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), false);
toggle.click();
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), true);

assert.equal(observations.length, 2);
assert.equal(observations[0].target, messages);
assert.equal(observations[0].options.characterData, true);
assert.equal(observations[1].target, sendButton);
assert.equal(Array.from(observations[1].options.attributeFilter).join(','), 'class');

long.content.textContent = 'artık kısa';
controller.refresh();
assert.equal(action.removed, true);
assert.equal(long.article.dataset[api.MARKER], undefined);
assert.equal(long.content.classList.contains(api.CONTENT_CLASS), false);

long.content.textContent = 'z'.repeat(2000);
sendButton.classList.add('streaming');
controller.refresh();
assert.equal(long.article.dataset[api.MARKER], undefined);
sendButton.classList.remove('streaming');
controller.refresh();
assert.equal(long.article.dataset[api.MARKER], '1');

controller.destroy();
assert.equal(disconnected, true);
assert.equal(long.article.dataset[api.MARKER], undefined);
assert.equal(long.content.classList.contains(api.CONTENT_CLASS), false);
assert.deepEqual({ ...controller.snapshot() }, { mounted: false, threshold: 1800, decorated: 0 });

console.log('response fold lifecycle ok');
