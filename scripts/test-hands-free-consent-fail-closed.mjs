import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const consent = require('../public/hands-free-consent.js');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeNode {
  constructor({ textContent = '', title = '', disabled = false, hidden = false } = {}) {
    this.textContent = textContent;
    this.title = title;
    this.disabled = disabled;
    this.hidden = hidden;
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentNode = null;
    this.nextSibling = null;
    this.classList = new FakeClassList();
  }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) {
    const group = this.listeners.get(type) || new Set();
    group.add(callback);
    this.listeners.set(type, group);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  insertAdjacentElement(_position, node) { this.append(node); return node; }
  insertBefore(node) { this.append(node); return node; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((entry) => entry !== this);
    this.parentNode = null;
  }
  focus() {}
  click() {
    const event = { type: 'click', preventDefault() {}, stopImmediatePropagation() {} };
    for (const callback of this.listeners.get('click') || []) callback(event);
  }
}

class FakeDocument extends FakeNode {
  constructor({ toggle, indicator, existingReview = null, mountPanels = true } = {}) {
    super();
    this.toggle = toggle;
    this.indicator = indicator;
    this.existingReview = existingReview;
    this.hidden = false;
    this.mountPanels = mountPanels;
    this.created = [];
  }
  querySelector(selector) {
    if (selector === '#handsFreeToggle') return this.toggle;
    if (selector === '#handsFreeIndicator') return this.indicator;
    return null;
  }
  getElementById(id) { return id === consent.REVIEW_ID ? this.existingReview : null; }
  createElement() {
    const node = new FakeNode();
    if (!this.mountPanels) node.insertAdjacentElement = undefined;
    this.created.push(node);
    return node;
  }
}

function buildHarness({ collision = false, mountPanels = true } = {}) {
  const toggle = new FakeNode({ textContent: 'Eller serbest', title: 'Host hands-free title', disabled: false });
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-describedby', 'host-description');
  toggle.setAttribute('data-consent-pending', 'host-pending');
  toggle.setAttribute('data-consent-blocked', 'host-blocked');
  const hostParent = new FakeNode();
  const indicator = new FakeNode();
  if (mountPanels) hostParent.append(indicator);
  const existingReview = collision ? new FakeNode() : null;
  const documentRef = new FakeDocument({ toggle, indicator, existingReview, mountPanels });

  let timerId = 0;
  const timers = new Map();
  const root = {
    isSecureContext: true,
    setTimeout(callback) { timerId += 1; timers.set(timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  return { toggle, indicator, documentRef, root, timers };
}

const collision = buildHarness({ collision: true });
const blocked = consent.installHandsFreeConsent(collision.documentRef, collision.root);
assert.ok(blocked, 'review ID collision sessiz null yerine fail-closed controller üretmeli');
assert.equal(blocked.isBlocked(), true);
assert.equal(blocked.getBlockReason(), 'review-collision');
assert.equal(blocked.isPending(), false);
assert.equal(blocked.begin(), false);
assert.equal(blocked.cancel(), false);
assert.equal(collision.toggle.disabled, true, 'consent güvenle kurulamadığında hands-free toggle disabled olmalı');
assert.equal(collision.toggle.getAttribute('data-consent-blocked'), 'review-collision');
assert.match(collision.toggle.title, /güvenli biçimde başlatılamadı/);
assert.equal(collision.toggle.getAttribute('aria-describedby'), 'host-description');
assert.throws(
  () => consent.installHandsFreeConsent(collision.documentRef, collision.root),
  /HANDS_FREE_CONSENT_ALREADY_INSTALLED/,
  'blocked controller da duplicate installationı engellemeli'
);
blocked.destroy();
assert.equal(blocked.isBlocked(), false);
assert.equal(blocked.getBlockReason(), '');
assert.equal(collision.toggle.disabled, false);
assert.equal(collision.toggle.title, 'Host hands-free title');
assert.equal(collision.toggle.getAttribute('data-consent-pending'), 'host-pending');
assert.equal(collision.toggle.getAttribute('data-consent-blocked'), 'host-blocked');
assert.equal(collision.toggle.getAttribute('aria-describedby'), 'host-description');

const remountBlocked = consent.installHandsFreeConsent(collision.documentRef, collision.root);
assert.ok(remountBlocked, 'blocked destroy ownership kaydını bırakmalı');
remountBlocked.destroy();

const missingMount = buildHarness({ mountPanels: false });
missingMount.indicator.parentNode = null;
missingMount.indicator.insertAdjacentElement = undefined;
const mountBlocked = consent.installHandsFreeConsent(missingMount.documentRef, missingMount.root);
assert.ok(mountBlocked);
assert.equal(mountBlocked.isBlocked(), true, 'review panel DOMa mount edilemiyorsa hands-free fail-closed kalmalı');
assert.equal(mountBlocked.getBlockReason(), 'review-mount-failed');
assert.equal(missingMount.toggle.disabled, true);
mountBlocked.destroy();
assert.equal(missingMount.toggle.disabled, false);

const normal = buildHarness();
const controller = consent.installHandsFreeConsent(normal.documentRef, normal.root);
assert.ok(controller);
assert.equal(controller.isBlocked(), false);
assert.equal(controller.getBlockReason(), '');
assert.equal(normal.toggle.listenerCount('click'), 1);
assert.equal(normal.documentRef.listenerCount('keydown'), 1);
assert.equal(normal.documentRef.listenerCount('visibilitychange'), 1);
assert.equal(controller.begin(), true);
assert.equal(controller.isPending(), true);
assert.equal(normal.toggle.getAttribute('data-consent-pending'), 'true');
assert.equal(normal.toggle.getAttribute('data-consent-blocked'), null, 'normal consent flow stale host blocked markerını sahiplenmeli');
assert.equal(normal.toggle.getAttribute('aria-describedby'), consent.REVIEW_ID);
assert.equal(normal.timers.size, 1);
assert.throws(
  () => consent.installHandsFreeConsent(normal.documentRef, normal.root),
  /HANDS_FREE_CONSENT_ALREADY_INSTALLED/
);

controller.destroy();
assert.equal(controller.isPending(), false);
assert.equal(normal.timers.size, 0, 'destroy pending consent timerını temizlemeli');
assert.equal(normal.toggle.listenerCount('click'), 0);
assert.equal(normal.documentRef.listenerCount('keydown'), 0);
assert.equal(normal.documentRef.listenerCount('visibilitychange'), 0);
assert.equal(normal.toggle.disabled, false);
assert.equal(normal.toggle.title, 'Host hands-free title');
assert.equal(normal.toggle.getAttribute('data-consent-pending'), 'host-pending');
assert.equal(normal.toggle.getAttribute('data-consent-blocked'), 'host-blocked');
assert.equal(normal.toggle.getAttribute('aria-describedby'), 'host-description');

console.log('Hands-free consent fail-closed OK: collision/mount blocking, duplicate ownership and exact restoration');