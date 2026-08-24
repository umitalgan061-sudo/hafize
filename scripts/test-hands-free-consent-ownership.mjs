import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/hands-free-consent.js');

function element(tag = 'div') {
  const listeners = new Map();
  const attributes = new Map();
  const children = [];
  return {
    tag,
    id: '',
    className: '',
    hidden: false,
    disabled: false,
    textContent: '',
    parentNode: null,
    nextSibling: null,
    children,
    focused: 0,
    removed: false,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener(type, fn, options) { listeners.set(`${type}:${options === true ? 'capture' : 'bubble'}`, fn); },
    removeEventListener(type, fn, options) {
      const key = `${type}:${options === true ? 'capture' : 'bubble'}`;
      if (listeners.get(key) === fn) listeners.delete(key);
    },
    append(...items) {
      for (const item of items) {
        item.parentNode = this;
        children.push(item);
      }
    },
    insertAdjacentElement(_position, item) {
      item.parentNode = this.parentNode;
      this.parentNode?.children.push(item);
    },
    focus() { this.focused += 1; },
    click() { listeners.get('click:capture')?.({ preventDefault() {}, stopImmediatePropagation() {} }); },
    fire(type, event = {}) {
      listeners.get(`${type}:bubble`)?.({ preventDefault() {}, ...event });
    },
    fireCapture(type, event = {}) {
      listeners.get(`${type}:capture`)?.({ preventDefault() {}, stopImmediatePropagation() {}, ...event });
    },
    remove() {
      this.removed = true;
      if (this.parentNode) {
        const index = this.parentNode.children.indexOf(this);
        if (index >= 0) this.parentNode.children.splice(index, 1);
      }
      this.parentNode = null;
    },
    _listeners: listeners
  };
}

function createHarness({ existingReview = false } = {}) {
  const toggle = element('button');
  const indicator = element('div');
  const parent = element('section');
  parent.append(toggle, indicator);
  const documentListeners = new Map();
  const timers = [];
  let timerId = 0;
  const documentRef = {
    hidden: false,
    querySelector(selector) {
      if (selector === '#handsFreeToggle') return toggle;
      if (selector === '#handsFreeIndicator') return indicator;
      return null;
    },
    getElementById(id) { return existingReview && id === api.REVIEW_ID ? element() : null; },
    createElement: (tag) => element(tag),
    addEventListener(type, fn) { documentListeners.set(type, fn); },
    removeEventListener(type, fn) {
      if (documentListeners.get(type) === fn) documentListeners.delete(type);
    }
  };
  const root = {
    isSecureContext: true,
    setTimeout(fn, ms) {
      const timer = { id: ++timerId, fn, ms, cleared: false };
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(id) {
      const timer = timers.find((item) => item.id === id);
      if (timer) timer.cleared = true;
    }
  };
  return { toggle, indicator, parent, documentRef, documentListeners, timers, root };
}

const harness = createHarness();
harness.toggle.setAttribute('aria-pressed', 'false');
harness.toggle.setAttribute('aria-describedby', 'host-help');
harness.toggle.setAttribute('data-consent-pending', 'host-state');
const controller = api.installHandsFreeConsent(harness.documentRef, harness.root);
assert.ok(controller);
assert.equal(controller.isPending(), false);
assert.equal(harness.toggle.getAttribute('aria-describedby'), 'host-help');
assert.equal(harness.toggle.getAttribute('data-consent-pending'), 'false');

assert.equal(controller.begin(), true);
assert.equal(controller.isPending(), true);
assert.equal(harness.toggle.getAttribute('aria-describedby'), api.REVIEW_ID);
assert.equal(harness.toggle.getAttribute('data-consent-pending'), 'true');
assert.equal(harness.timers.at(-1).ms, api.CONSENT_TIMEOUT_MS);
assert.equal(controller.cancel(), true);
assert.equal(harness.toggle.getAttribute('aria-describedby'), 'host-help', 'cancel must restore host aria-describedby');
assert.equal(harness.toggle.getAttribute('data-consent-pending'), 'false');

assert.equal(controller.begin(), true);
const timeout = harness.timers.at(-1);
timeout.fn();
assert.equal(controller.isPending(), false);
assert.equal(harness.toggle.getAttribute('aria-describedby'), 'host-help', 'timeout must restore host aria-describedby');

assert.equal(controller.begin(), true);
harness.documentRef.hidden = true;
harness.documentListeners.get('visibilitychange')?.();
assert.equal(controller.isPending(), false);
assert.equal(harness.toggle.getAttribute('aria-describedby'), 'host-help');
harness.documentRef.hidden = false;

controller.destroy();
controller.destroy();
assert.equal(harness.toggle.getAttribute('aria-describedby'), 'host-help');
assert.equal(harness.toggle.getAttribute('data-consent-pending'), 'host-state', 'destroy must restore pre-existing host marker');
assert.equal(harness.documentListeners.has('keydown'), false);
assert.equal(harness.documentListeners.has('visibilitychange'), false);
assert.equal(harness.parent.children.some((item) => item.id === api.REVIEW_ID), false);
assert.equal(controller.begin(), false, 'destroyed consent controller must stay inert');

const clean = createHarness();
clean.toggle.setAttribute('aria-pressed', 'false');
const cleanController = api.installHandsFreeConsent(clean.documentRef, clean.root);
assert.ok(cleanController);
cleanController.destroy();
assert.equal(clean.toggle.hasAttribute('aria-describedby'), false);
assert.equal(clean.toggle.hasAttribute('data-consent-pending'), false, 'controller-created marker must be removed on destroy');

const collision = createHarness({ existingReview: true });
collision.toggle.setAttribute('aria-pressed', 'false');
const collisionController = api.installHandsFreeConsent(collision.documentRef, collision.root);
assert.ok(collisionController, 'existing review id must install a fail-closed controller');
assert.equal(collisionController.isBlocked(), true);
assert.equal(collisionController.getBlockReason(), 'review-collision');
assert.equal(collisionController.begin(), false, 'blocked controller must never start consent');
assert.equal(collision.toggle.disabled, true, 'review collision must disable the hands-free toggle');
assert.equal(collision.toggle.getAttribute('data-consent-blocked'), 'review-collision');
assert.equal(collision.parent.children.length, 2);
collisionController.destroy();
assert.equal(collision.toggle.disabled, false, 'destroy must restore the host toggle baseline');
assert.equal(collision.toggle.hasAttribute('data-consent-blocked'), false);

const insecure = createHarness();
insecure.toggle.setAttribute('aria-pressed', 'false');
insecure.root.isSecureContext = false;
const insecureController = api.installHandsFreeConsent(insecure.documentRef, insecure.root);
assert.ok(insecureController);
assert.equal(insecureController.begin(), false, 'insecure context must not open microphone consent review');
insecureController.destroy();

console.log('hands-free consent ownership tests passed');