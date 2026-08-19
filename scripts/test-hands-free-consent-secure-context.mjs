import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const consent = require('../public/hands-free-consent.js');

class Node {
  constructor() {
    this.disabled = false;
    this.title = 'Host title';
    this.hidden = false;
    this.textContent = '';
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentNode = null;
  }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) {
    const set = this.listeners.get(type) || new Set();
    set.add(callback);
    this.listeners.set(type, set);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  insertAdjacentElement(_where, node) { this.append(node); return node; }
  insertBefore(node) { this.append(node); return node; }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  focus() {}
  click() {
    const event = { preventDefault() {}, stopImmediatePropagation() {} };
    for (const callback of this.listeners.get('click') || []) callback(event);
  }
}

function buildHarness({ secure = true } = {}) {
  const toggle = new Node();
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-describedby', 'host-description');
  const indicator = new Node();
  const parent = new Node();
  parent.append(indicator);
  const documentRef = new Node();
  documentRef.hidden = false;
  documentRef.querySelector = (selector) => selector === '#handsFreeToggle' ? toggle : selector === '#handsFreeIndicator' ? indicator : null;
  documentRef.getElementById = () => null;
  documentRef.createElement = () => new Node();
  let timerId = 0;
  const timers = new Map();
  const root = {
    isSecureContext: secure,
    setTimeout(callback) { timerId += 1; timers.set(timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  return { toggle, documentRef, root, timers };
}

assert.equal(consent.canReview({ hidden: false }, { isSecureContext: true }, { disabled: false, getAttribute: () => 'false' }), true);
assert.equal(consent.canReview({ hidden: true }, { isSecureContext: true }, { disabled: false, getAttribute: () => 'false' }), false);
assert.equal(consent.canReview({ hidden: false }, { isSecureContext: false }, { disabled: false, getAttribute: () => 'false' }), false);
assert.equal(consent.canReview({ hidden: false }, { isSecureContext: true }, { disabled: true, getAttribute: () => 'false' }), false);

const insecure = buildHarness({ secure: false });
const insecureController = consent.installHandsFreeConsent(insecure.documentRef, insecure.root);
assert.ok(insecureController);
assert.equal(insecureController.begin(), false, 'güvensiz context consent review başlatmamalı');
insecure.toggle.click();
assert.equal(insecureController.isPending(), false);
assert.equal(insecure.timers.size, 0, 'güvensiz context consent timerı oluşturmamalı');
insecureController.destroy();
assert.equal(insecure.toggle.title, 'Host title');
assert.equal(insecure.toggle.getAttribute('aria-describedby'), 'host-description');

const normal = buildHarness();
const controller = consent.installHandsFreeConsent(normal.documentRef, normal.root);
assert.ok(controller);
assert.equal(controller.begin(), true);
assert.equal(controller.isPending(), true);
assert.equal(normal.timers.size, 1);
const timeout = normal.timers.values().next().value;
timeout();
assert.equal(controller.isPending(), false, 'review süre dolunca kapanmalı');
assert.equal(normal.toggle.getAttribute('data-consent-pending'), 'false');
assert.equal(normal.toggle.getAttribute('aria-describedby'), 'host-description');
assert.equal(controller.begin(), true, 'timeout sonrası yeni açık kullanıcı review isteği mümkün olmalı');
assert.equal(controller.cancel(), true);
assert.equal(controller.cancel(), false, 'pending olmayan review cancel yan etkisi üretmemeli');
controller.destroy();
assert.equal(normal.timers.size, 0);
assert.equal(normal.toggle.title, 'Host title');
assert.equal(normal.toggle.getAttribute('aria-describedby'), 'host-description');

console.log('Hands-free consent secure-context OK: insecure denial, timeout expiry and retry lifecycle');