import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const reading = require('../public/conversation-reading-controls.js');

assert.deepEqual(reading.SCALE_OPTIONS, ['90', '100', '110', '125']);
assert.deepEqual(reading.SPACING_OPTIONS, ['compact', 'normal', 'relaxed']);
assert.equal(reading.normalizeScale('125'), '125');
assert.equal(reading.normalizeScale(90), '90');
assert.equal(reading.normalizeScale('500'), '100');
assert.equal(reading.normalizeSpacing('relaxed'), 'relaxed');
assert.equal(reading.normalizeSpacing('wide'), 'normal');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === undefined) {
      if (this.values.has(value)) this.values.delete(value);
      else this.values.add(value);
      return this.values.has(value);
    }
    if (force) this.values.add(value);
    else this.values.delete(value);
    return force;
  }
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
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.type = '';
    this.title = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    const group = this.listeners.get(type) || new Set();
    group.add(listener);
    this.listeners.set(type, group);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type) { for (const listener of this.listeners.get(type) || []) listener({ type, target: this }); }
  click() { this.dispatch('click'); }
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
    if (!selector.startsWith('#')) return null;
    const id = selector.slice(1);
    return walk(this).find((node) => node.id === id) || null;
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

function makeDocument() {
  const messages = new FakeElement('div');
  messages.id = 'messages';
  const shell = new FakeElement('div');
  shell.classList = new FakeClassList(['app-shell']);
  const rail = new FakeElement('aside');
  rail.classList = new FakeClassList(['utility-rail']);
  const topbar = new FakeElement('header');
  topbar.classList = new FakeClassList(['topbar']);
  shell.append(topbar, messages, rail);

  const documentRef = {
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '.app-shell') return shell;
      if (selector === '.utility-rail') return rail;
      if (selector === '.topbar') return topbar;
      if (selector.startsWith('#')) return walk(shell).find((node) => node.id === selector.slice(1)) || null;
      return null;
    }
  };
  return { documentRef, messages, shell, rail, topbar };
}

const { documentRef, messages, shell, rail, topbar } = makeDocument();
const controller = reading.createController({ documentRef });
assert.equal(controller.mount(), true);
assert.deepEqual(controller.getState(), { mounted: true, scale: '100', spacing: 'normal', focused: false });
assert.equal(messages.dataset.readingScale, '100');
assert.equal(messages.dataset.readingSpacing, 'normal');
assert.equal(rail.children.length, 1);
assert.equal(topbar.children.length, 1);

const card = documentRef.querySelector(`#${reading.CARD_ID}`);
const scaleSelect = card.querySelector('#conversationReadingScale');
const spacingSelect = card.querySelector('#conversationReadingSpacing');
const focusButton = documentRef.querySelector(`#${reading.FOCUS_BUTTON_ID}`);
assert.ok(card && scaleSelect && spacingSelect && focusButton);
assert.equal(scaleSelect.getAttribute('aria-label'), 'Sohbet mesajı yazı boyutu');
assert.equal(spacingSelect.getAttribute('aria-label'), 'Sohbet mesajı satır aralığı');
assert.equal(focusButton.getAttribute('aria-pressed'), 'false');
assert.equal(focusButton.getAttribute('aria-label'), 'Sohbet odak modunu aç');

assert.equal(controller.setScale('125'), '125');
assert.equal(messages.dataset.readingScale, '125');
assert.equal(scaleSelect.value, '125');
assert.equal(controller.setScale('999'), '100', 'unexpected scale must fail closed to the default');
assert.equal(messages.dataset.readingScale, '100');

scaleSelect.value = '110';
scaleSelect.dispatch('change');
assert.equal(controller.getState().scale, '110');
assert.equal(messages.dataset.readingScale, '110');
spacingSelect.value = 'relaxed';
spacingSelect.dispatch('change');
assert.equal(controller.getState().spacing, 'relaxed');
assert.equal(messages.dataset.readingSpacing, 'relaxed');
assert.equal(controller.setSpacing('unknown'), 'normal');

focusButton.click();
assert.equal(controller.getState().focused, true);
assert.equal(shell.classList.contains(reading.FOCUS_CLASS), true);
assert.equal(focusButton.getAttribute('aria-pressed'), 'true');
assert.equal(focusButton.getAttribute('aria-label'), 'Sohbet odak modundan çık');
assert.match(focusButton.textContent, /Odaktan çık/);
focusButton.click();
assert.equal(controller.getState().focused, false);
assert.equal(shell.classList.contains(reading.FOCUS_CLASS), false);

controller.setFocused(true);
controller.destroy();
assert.equal(shell.classList.contains(reading.FOCUS_CLASS), false, 'destroy must always leave focus mode');
assert.equal('readingScale' in messages.dataset, false);
assert.equal('readingSpacing' in messages.dataset, false);
assert.equal(rail.children.length, 0, 'generated reading card should be removed');
assert.equal(topbar.children.length, 0, 'generated focus button should be removed');
assert.deepEqual(controller.getState(), { mounted: false, scale: '100', spacing: 'normal', focused: false });

const reused = makeDocument();
const existingCard = reading.createReadingCard(reused.documentRef);
const existingFocus = reading.createFocusButton(reused.documentRef);
reused.rail.append(existingCard);
reused.topbar.append(existingFocus);
const reusedController = reading.createController({ documentRef: reused.documentRef });
assert.equal(reusedController.mount(), true);
assert.equal(reused.rail.children.length, 1, 'existing reading card should be reused');
assert.equal(reused.topbar.children.length, 1, 'existing focus button should be reused');
reusedController.destroy();
assert.equal(reused.rail.children.length, 1, 'pre-existing reading card must survive destroy');
assert.equal(reused.topbar.children.length, 1, 'pre-existing focus button must survive destroy');

const invalidDocument = { createElement: reused.documentRef.createElement, querySelector: () => null };
assert.equal(reading.mount({ documentRef: invalidDocument }), null);
assert.equal(reading.mount({ documentRef: null }), null);

const source = fs.readFileSync(new URL('../public/conversation-reading-controls.js', import.meta.url), 'utf8');
for (const forbidden of [
  /localStorage/,
  /sessionStorage/,
  /document\.cookie/,
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /navigator\.clipboard/,
  /requestSubmit\s*\(/,
  /\.submit\s*\(/
]) assert.doesNotMatch(source, forbidden, `reading controls must remain session-only and passive: ${forbidden}`);

console.log('conversation reading controls tests passed');
