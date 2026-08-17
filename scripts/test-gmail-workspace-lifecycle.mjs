import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspace = require('../public/gmail-workspace.js');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
}

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.focused = false;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((item) => item !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'aria-pressed') this.ariaPressed = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    event.target ||= this;
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    return true;
  }
  click() { this.dispatchEvent({ type: 'click', target: this }); }
  focus() { this.focused = true; }
  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains?.(target));
  }
  closest(selector) {
    if (selector === '[data-gmail-preset]' && this.dataset.gmailPreset) return this;
    return this.parentNode?.closest?.(selector) || null;
  }
  querySelector(selector) {
    if (selector === '[data-hafize-gmail-workspace]') {
      return this.children.find((child) => child.dataset?.hafizeGmailWorkspace === '1') || null;
    }
    return null;
  }
  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      if (selector === '[data-gmail-preset]' && node.dataset?.gmailPreset) matches.push(node);
      for (const child of node.children || []) visit(child);
    };
    visit(this);
    return matches;
  }
  insertAdjacentElement(position, node) {
    if (position !== 'afterend' || !this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    node.parentNode = this.parentNode;
    this.parentNode.children.splice(index + 1, 0, node);
    return node;
  }
}

const account = new FakeNode('section');
const gmailStatus = new FakeNode('p');
gmailStatus.dataset.state = 'linked';
account.append(gmailStatus);
const composer = new FakeNode('form');
const input = new FakeNode('textarea');
const toolButton = new FakeNode('button');
toolButton.setAttribute('aria-pressed', 'false');
const sendButton = new FakeNode('button');

const nodes = new Map([
  ['#accountConnectionCard', account],
  ['#gmailConnectionStatus', gmailStatus],
  ['#composer', composer],
  ['#messageInput', input],
  ['#toolModeBtn', toolButton],
  ['#sendBtn', sendButton]
]);

const documentRef = {
  body: new FakeNode('body'),
  createElement: (tag) => new FakeNode(tag),
  querySelector: (selector) => nodes.get(selector) || null
};

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; this.disconnected = false; }
  observe() {}
  disconnect() { this.disconnected = true; }
}

class FakeEvent {
  constructor(type, options = {}) { this.type = type; this.bubbles = Boolean(options.bubbles); this.target = null; }
}

const root = { MutationObserver: FakeMutationObserver, Event: FakeEvent };
const controller = workspace.install(documentRef, root);
assert.ok(controller, 'workspace should mount with required nodes');
const section = account.children.find((node) => node.dataset?.hafizeGmailWorkspace === '1');
assert.ok(section);
assert.equal(section.hidden, false);

assert.equal(controller.placePrompt(workspace.PRESETS.recent), true);
assert.equal(input.value, workspace.PRESETS.recent);
assert.equal(input.focused, true);

input.value = 'Mevcut kullanıcı taslağı';
assert.equal(controller.placePrompt(workspace.PRESETS.unread), false, 'non-empty draft must fail closed');
assert.equal(input.value, 'Mevcut kullanıcı taslağı');

input.value = '';
sendButton.classList.add('streaming');
controller.render();
assert.equal(controller.placePrompt(workspace.PRESETS.unread), false, 'streaming must block draft insertion');
assert.equal(input.value, '');
sendButton.classList.remove('streaming');

gmailStatus.dataset.state = 'unlinked';
controller.render();
assert.equal(section.hidden, true);
assert.equal(controller.placePrompt(workspace.PRESETS.recent), false);

gmailStatus.dataset.state = 'linked';
toolButton.disabled = false;
toolButton.click = () => toolButton.setAttribute('aria-pressed', 'true');
controller.render();
const toolAction = section.children.find((node) => node.className === 'gmail-workspace-tool-action');
assert.ok(toolAction);
toolAction.click();
assert.equal(toolButton.getAttribute('aria-pressed'), 'true');

controller.destroy();
assert.equal(account.children.includes(section), false, 'destroy must remove generated UI');
assert.equal(controller.placePrompt(workspace.PRESETS.recent), false, 'destroyed controller must stay inert');

console.log('gmail workspace lifecycle tests passed');
