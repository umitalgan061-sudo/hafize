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
    type: '', className: '', textContent: '', title: '', removed: false,
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
    addEventListener(name, handler) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(handler);
    },
    removeEventListener(name, handler) { handlers.get(name)?.delete(handler); },
    click() { for (const handler of [...(handlers.get('click') || [])]) handler({ preventDefault() {} }); },
    handlerCount(name) { return handlers.get(name)?.size || 0; }
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

function makeArticle(text = 'x'.repeat(2000), { id = '', contentClasses = [], marker } = {}) {
  const content = { id, textContent: text, classList: makeClassList(contentClasses) };
  const children = [];
  const dataset = {};
  if (marker !== undefined) dataset[api.MARKER] = marker;
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
const long = makeArticle('x'.repeat(2000), { id: 'host-content', contentClasses: [api.CONTENT_CLASS] });
const foreign = makeArticle('y'.repeat(2000), { marker: '1', contentClasses: [api.CONTENT_CLASS, api.COLLAPSED_CLASS] });
const foreignActions = makeActions();
foreignActions.className = api.ACTIONS_CLASS;
foreign.article.append(foreignActions);
const assistantArticles = [short.article, long.article, foreign.article];
const messages = {
  querySelectorAll(selector) {
    if (selector === '.message.assistant') return assistantArticles;
    if (selector === `.${api.ACTIONS_CLASS}`) {
      return assistantArticles.flatMap((article) => {
        const action = article.querySelector?.(`.${api.ACTIONS_CLASS}`);
        return action ? [action] : [];
      });
    }
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
assert.equal(foreign.article.dataset[api.MARKER], '1');
assert.equal(foreign.article.querySelector(`.${api.ACTIONS_CLASS}`), foreignActions);
assert.equal(long.content.classList.contains(api.CONTENT_CLASS), true);
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), true);
assert.equal(long.content.id, 'host-content');

const action = long.children.find((node) => node.className === api.ACTIONS_CLASS && !node.removed);
const toggle = action.children[0];
assert.equal(toggle.getAttribute('aria-controls'), 'host-content');
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(toggle.textContent, 'Devamını göster');
toggle.click();
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), false);
toggle.click();
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), true);
assert.equal(observations.length, 2);

long.content.textContent = 'artık kısa';
controller.refresh();
assert.equal(action.removed, true);
assert.equal(toggle.handlerCount('click'), 0);
assert.equal(long.article.dataset[api.MARKER], undefined);
assert.equal(long.content.classList.contains(api.CONTENT_CLASS), true);
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), false);
assert.equal(long.content.id, 'host-content');

long.content.textContent = 'z'.repeat(2000);
sendButton.classList.add('streaming');
controller.refresh();
assert.equal(long.article.dataset[api.MARKER], undefined);
sendButton.classList.remove('streaming');
controller.refresh();
assert.equal(long.article.dataset[api.MARKER], '1');
const remountedAction = long.article.querySelector(`.${api.ACTIONS_CLASS}`);
const remountedToggle = remountedAction.children[0];

controller.destroy();
assert.equal(disconnected, true);
assert.equal(remountedAction.removed, true);
assert.equal(remountedToggle.handlerCount('click'), 0);
assert.equal(long.article.dataset[api.MARKER], undefined);
assert.equal(long.content.classList.contains(api.CONTENT_CLASS), true);
assert.equal(long.content.classList.contains(api.COLLAPSED_CLASS), false);
assert.equal(long.content.id, 'host-content');
assert.equal(foreign.article.dataset[api.MARKER], '1');
assert.equal(foreignActions.removed, false);
assert.equal(foreign.content.classList.contains(api.COLLAPSED_CLASS), true);
assert.deepEqual({ ...controller.snapshot() }, { mounted: false, threshold: 1800, decorated: 0 });
assert.equal(controller.refresh(), 0);
assert.equal(controller.decorate(long.article), false);
assert.equal(controller.decorateAll(messages), 0);
assert.equal(controller.mount(), false);
controller.destroy();

console.log('response fold lifecycle ok');
