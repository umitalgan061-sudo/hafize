import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  REVOCATION_NOTICE,
  installHandsFreeBackgroundGuard
} = require('../public/hands-free-background-guard.js');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn, capture = false) {
    const list = this.listeners.get(type) || [];
    list.push({ fn, capture: Boolean(capture) });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn, capture = false) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item.fn !== fn || item.capture !== Boolean(capture)));
  }
  dispatchEvent(event) {
    const list = [...(this.listeners.get(event?.type) || [])];
    for (const item of list.filter((entry) => entry.capture)) item.fn(event);
    for (const item of list.filter((entry) => !entry.capture)) item.fn(event);
    return true;
  }
  fire(type) {
    return this.dispatchEvent({ type });
  }
}

function harness() {
  const documentRef = new Target();
  const root = new Target();
  const attrs = new Map([['aria-pressed', 'true']]);
  const toggle = {
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: (name) => attrs.delete(name),
    hasAttribute: (name) => attrs.has(name),
    click() { throw new Error('SYNTHETIC_CONSENT_CLICK_FORBIDDEN'); }
  };
  const hiddenClasses = new Set(['hidden']);
  const toast = {
    textContent: 'host message',
    classList: {
      remove(value) { hiddenClasses.delete(value); },
      contains(value) { return hiddenClasses.has(value); }
    }
  };
  documentRef.hidden = false;
  documentRef.querySelector = (selector) => ({ '#handsFreeToggle': toggle, '#toast': toast })[selector] || null;
  documentRef.addEventListener(HANDS_FREE_REVOKE_EVENT, () => toggle.setAttribute('aria-pressed', 'false'));
  return { documentRef, root, toggle, toast };
}

{
  const h = harness();
  const controller = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  h.documentRef.hidden = true;
  h.documentRef.fire('visibilitychange');
  assert.equal(controller.hasPendingNotice(), true);
  assert.equal(h.toast.textContent, 'host message', 'notice must not be painted while document is hidden');

  h.documentRef.hidden = false;
  h.documentRef.fire('visibilitychange');
  assert.equal(controller.hasPendingNotice(), false);
  assert.equal(h.toast.textContent, REVOCATION_NOTICE);
  assert.equal(h.toast.classList.contains('hidden'), false);
  assert.match(h.toast.textContent, /tekrar onay ver/);

  h.documentRef.fire('visibilitychange');
  assert.equal(h.toast.textContent, REVOCATION_NOTICE, 'notice is one-shot and must not create repeated UI churn');
  controller.destroy();
}

{
  const h = harness();
  const controller = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  h.root.fire('pagehide');
  assert.equal(controller.hasPendingNotice(), true);
  h.root.fire('pageshow');
  assert.equal(controller.hasPendingNotice(), false);
  assert.equal(h.toast.textContent, REVOCATION_NOTICE);
  controller.destroy();
}

{
  const h = harness();
  h.documentRef.querySelector = (selector) => selector === '#handsFreeToggle' ? h.toggle : null;
  const controller = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  h.documentRef.hidden = true;
  h.documentRef.fire('visibilitychange');
  h.documentRef.hidden = false;
  assert.equal(controller.announce(), false, 'missing toast must fail safely without inventing a UI surface');
  assert.equal(controller.hasPendingNotice(), true, 'notice remains pending when no visible status surface exists');
  controller.destroy();
}

{
  const h = harness();
  const controller = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  assert.equal(controller.revoke(), true);
  assert.equal(controller.hasPendingNotice(), false, 'explicit guard revocation must not masquerade as background navigation');
  controller.destroy();
}

console.log('hands-free background re-consent notice tests passed');
