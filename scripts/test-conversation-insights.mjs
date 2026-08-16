import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const insights = require('../public/conversation-insights.js');

assert.equal(insights.normalizeVisibleText('  Merhaba\n\tHafize  '), 'Merhaba Hafize');
assert.equal(insights.normalizeVisibleText(null), '');
assert.equal(insights.countWords('Bir iki   üç'), 3);
assert.equal(insights.countWords('   '), 0);
assert.equal(insights.estimateReadingMinutes(0), 0);
assert.equal(insights.estimateReadingMinutes(1), 1);
assert.equal(insights.estimateReadingMinutes(221), 2);
assert.equal(insights.estimateReadingMinutes(300, 0), 2, 'invalid pace should use safe default');
assert.equal(insights.formatStats({ totalMessages: 0 }), 'Aktif sohbette henüz mesaj yok.');
assert.match(insights.formatStats({ totalMessages: 2, words: 8, readingMinutes: 1 }), /2 mesaj · 8 kelime · yaklaşık 1 dk okuma/);

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.className = '';
    this.classList = new FakeClassList();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  querySelector(selector) {
    if (selector.startsWith('#')) return walk(this).find((node) => node.id === selector.slice(1)) || null;
    const metric = selector.match(/^\[data-metric="([^"]+)"\] dd$/);
    if (metric) {
      const container = walk(this).find((node) => node.dataset?.metric === metric[1]);
      return container?.children?.find((node) => node.tagName === 'DD') || null;
    }
    return null;
  }
}

function walk(root) {
  const result = [];
  const visit = (node) => {
    result.push(node);
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  return result;
}

function message(role, text) {
  const article = new FakeElement('article');
  article.classList = new FakeClassList(['message', role]);
  const content = new FakeElement('div');
  content.classList = new FakeClassList(['content']);
  content.textContent = text;
  article.querySelector = (selector) => selector === '.content' ? content : null;
  return article;
}

const userOne = message('user', 'Merhaba Hafize');
const assistantOne = message('assistant', 'Merhaba. Sana nasıl yardımcı olabilirim?');
const ignoredTool = message('tool', 'Bu metin sayılmamalı');
const userTwo = message('user', 'Bugün plan yapalım.');
const allMessages = [userOne, assistantOne, ignoredTool, userTwo];
const messages = new FakeElement('div');
messages.id = 'messages';
messages.querySelectorAll = (selector) => selector === '.message' ? allMessages : [];

const stats = insights.collectConversationStats(messages);
assert.deepEqual(stats, {
  totalMessages: 3,
  userMessages: 2,
  assistantMessages: 1,
  words: 10,
  characters: 73,
  readingMinutes: 1
});
assert.equal(Object.isFrozen(stats), true);

const rail = new FakeElement('aside');
rail.className = 'utility-rail';
const documentRef = {
  createElement: (tag) => new FakeElement(tag),
  querySelector(selector) {
    if (selector === '#messages') return messages;
    if (selector === '.utility-rail') return rail;
    if (selector === `#${insights.CARD_ID}`) return walk(rail).find((node) => node.id === insights.CARD_ID) || null;
    return null;
  }
};

class FakeObserver {
  constructor(callback) { this.callback = callback; this.observed = []; this.disconnected = false; }
  observe(target, options) { this.observed.push({ target, options }); FakeObserver.last = this; }
  disconnect() { this.disconnected = true; }
}

const controller = insights.createController({ documentRef, MutationObserverImpl: FakeObserver });
assert.equal(controller.mount(), true);
assert.equal(rail.children.length, 1);
const card = rail.children[0];
assert.equal(card.id, insights.CARD_ID);
assert.equal(card.hidden, false);
assert.equal(card.querySelector(`#${insights.STATUS_ID}`).textContent, '3 mesaj · 10 kelime · yaklaşık 1 dk okuma');
assert.equal(card.querySelector('[data-metric="user"] dd').textContent, '2');
assert.equal(card.querySelector('[data-metric="assistant"] dd').textContent, '1');
assert.equal(card.querySelector('[data-metric="characters"] dd').textContent, '73');
assert.equal(FakeObserver.last.observed.length, 1);
assert.deepEqual(FakeObserver.last.observed[0].options, { childList: true, subtree: true, characterData: true });

allMessages.push(message('assistant', 'Yeni yanıt burada.'));
FakeObserver.last.callback();
assert.equal(card.querySelector('[data-metric="assistant"] dd').textContent, '2');
assert.match(card.querySelector(`#${insights.STATUS_ID}`).textContent, /^4 mesaj/);
assert.equal(controller.snapshot().totalMessages, 4);

allMessages.splice(0, allMessages.length);
controller.render();
assert.equal(card.hidden, true, 'empty conversations should not leave visual card noise');
assert.equal(card.querySelector(`#${insights.STATUS_ID}`).textContent, 'Aktif sohbette henüz mesaj yok.');

const observer = FakeObserver.last;
controller.destroy();
assert.equal(observer.disconnected, true);
assert.equal(rail.children.length, 0, 'generated insight card should be removed on destroy');

const existingCard = insights.createCard(documentRef);
rail.append(existingCard);
const existingController = insights.createController({ documentRef, MutationObserverImpl: null });
assert.equal(existingController.mount(), true);
assert.equal(rail.children.length, 1, 'existing card should be reused instead of duplicated');
existingController.destroy();
assert.equal(rail.children.length, 1, 'pre-existing card must not be removed on destroy');

const missingDocument = { createElement: documentRef.createElement, querySelector: () => null };
assert.equal(insights.mount({ documentRef: missingDocument, MutationObserverImpl: null }), null);
assert.equal(insights.mount({ documentRef: null }), null);

console.log('conversation insights tests passed');
