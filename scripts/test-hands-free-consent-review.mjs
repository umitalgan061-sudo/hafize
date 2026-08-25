import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/hands-free-consent.js');

assert.equal(api.CONSENT_TIMEOUT_MS, 15_000);
assert.equal(api.REVIEW_ID, 'handsFreeConsentReview');
assert.equal(typeof api.installHandsFreeConsent, 'function');
assert.equal(typeof api.createReview, 'function');

function makeClassList() {
  const values = new Set();
  return { add: (...items) => items.forEach((v) => values.add(v)), remove: (...items) => items.forEach((v) => values.delete(v)), contains: (v) => values.has(v) };
}

function makeElement(tag = 'div') {
  const listeners = new Map();
  const attrs = new Map();
  const children = [];
  return {
    tagName: tag.toUpperCase(), id: '', className: '', hidden: false, disabled: false, textContent: '', parentNode: null,
    classList: makeClassList(), children,
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    removeAttribute(name) { attrs.delete(name); },
    append(...nodes) { for (const node of nodes) { node.parentNode = this; children.push(node); } },
    insertAdjacentElement(_where, node) { node.parentNode = this.parentNode; this.parentNode?.children?.push?.(node); },
    addEventListener(type, fn, capture) { const key = `${type}:${Boolean(capture)}`; const list = listeners.get(key) || []; list.push(fn); listeners.set(key, list); },
    removeEventListener(type, fn, capture) { const key = `${type}:${Boolean(capture)}`; listeners.set(key, (listeners.get(key) || []).filter((v) => v !== fn)); },
    dispatch(type, event = {}, capture = false) { for (const fn of listeners.get(`${type}:${Boolean(capture)}`) || []) fn({ type, ...event }); },
    focus() { this.focused = true; },
    click() { this.clickCount = (this.clickCount || 0) + 1; this.dispatch('click', { preventDefault() {}, stopImmediatePropagation() {} }, true); this.dispatch('click', { preventDefault() {} }, false); },
    remove() { this.removed = true; }
  };
}

const toggle = makeElement('button');
toggle.id = 'handsFreeToggle';
toggle.setAttribute('aria-pressed', 'false');
const indicator = makeElement('small');
indicator.id = 'handsFreeIndicator';
const parent = makeElement('section');
parent.append(toggle, indicator);
const all = new Map([[toggle.id, toggle], [indicator.id, indicator]]);
const docListeners = new Map();
const documentRef = {
  hidden: false,
  createElement: makeElement,
  querySelector(selector) { return selector === '#handsFreeToggle' ? toggle : selector === '#handsFreeIndicator' ? indicator : null; },
  getElementById(id) { return all.get(id) || null; },
  addEventListener(type, fn) { const list = docListeners.get(type) || []; list.push(fn); docListeners.set(type, list); },
  removeEventListener(type, fn) { docListeners.set(type, (docListeners.get(type) || []).filter((v) => v !== fn)); },
  dispatch(type, event = {}) { for (const fn of docListeners.get(type) || []) fn({ type, ...event }); }
};

let timerId = 0;
const timers = new Map();
const root = {
  setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
  clearTimeout(id) { timers.delete(id); }
};

const controller = api.installHandsFreeConsent(documentRef, root);
assert.ok(controller);
assert.equal(controller.isPending(), false);

toggle.dispatch('click', { isTrusted: true, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } }, true);
assert.equal(controller.isPending(), true, 'first activation only opens review');
assert.equal(toggle.getAttribute('data-consent-pending'), 'true');
assert.equal(toggle.getAttribute('aria-describedby'), api.REVIEW_ID);
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].ms, 15_000);

const reviewPanel = parent.children.find((item) => item.id === api.REVIEW_ID);
assert.ok(reviewPanel, 'review is placed beside visible hands-free indicator');
assert.equal(reviewPanel.hidden, false);
const confirm = reviewPanel.children[2].children[0];
const cancel = reviewPanel.children[2].children[1];
assert.equal(confirm.textContent, 'Onayla ve dinlemeyi aç');
assert.equal(cancel.textContent, 'Vazgeç');

cancel.dispatch('click', { preventDefault() {} });
assert.equal(controller.isPending(), false);
assert.equal(toggle.getAttribute('aria-describedby'), null);
assert.equal(timers.size, 0);

assert.equal(controller.begin(), true);
const beforeConfirmClicks = toggle.clickCount || 0;
confirm.dispatch('click', { isTrusted: true, preventDefault() {} });
assert.equal(controller.isPending(), false);
assert.equal(toggle.clickCount, beforeConfirmClicks + 1, 'confirm hands off exactly one click to existing hands-free runtime');

assert.equal(controller.begin(), true);
documentRef.dispatch('keydown', { key: 'Escape', preventDefault() {} });
assert.equal(controller.isPending(), false, 'Escape cancels pending microphone consent');

assert.equal(controller.begin(), true);
documentRef.hidden = true;
documentRef.dispatch('visibilitychange');
assert.equal(controller.isPending(), false, 'backgrounding cancels pending consent');
documentRef.hidden = false;

assert.equal(controller.begin(), true);
const timeout = [...timers.values()][0];
timeout.fn();
assert.equal(controller.isPending(), false, 'review expires fail-closed');

controller.destroy();
assert.equal(reviewPanel.removed, true);
console.log('hands-free consent review tests passed');
