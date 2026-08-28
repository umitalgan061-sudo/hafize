import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  installHandsFreeBackgroundGuard,
  REVOCATION_NOTICE
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
  fire(type) { return this.dispatchEvent({ type }); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

function createHarness() {
  const documentRef = new Target();
  const root = new Target();
  const attrs = new Map([['aria-pressed', 'true']]);
  let clicks = 0;
  const toggle = {
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: (name) => attrs.delete(name),
    hasAttribute: (name) => attrs.has(name),
    click() {
      clicks += 1;
      throw new Error('SYNTHETIC_CONSENT_CLICK_FORBIDDEN');
    }
  };
  const hiddenClasses = new Set(['hidden']);
  const toast = {
    textContent: '',
    classList: {
      remove(value) { hiddenClasses.delete(value); },
      contains(value) { return hiddenClasses.has(value); }
    }
  };
  documentRef.hidden = false;
  documentRef.querySelector = (selector) => ({ '#handsFreeToggle': toggle, '#toast': toast })[selector] || null;
  documentRef.addEventListener(HANDS_FREE_REVOKE_EVENT, () => toggle.setAttribute('aria-pressed', 'false'));
  return { documentRef, root, toggle, toast, attrs, get clicks() { return clicks; } };
}

{
  const h = createHarness();
  const controller = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  assert.equal(h.root.listenerCount('blur'), 1);
  assert.equal(h.root.listenerCount('focus'), 1);

  h.root.fire('blur');
  assert.equal(h.clicks, 0, 'window blur must revoke without synthesizing a consent click');
  assert.equal(h.attrs.get('aria-pressed'), 'false');
  assert.equal(controller.getLastReason(), 'window-blur');
  assert.equal(controller.hasPendingNotice(), true);

  h.root.fire('focus');
  assert.equal(h.clicks, 0, 'focus must never re-enable hands-free');
  assert.equal(controller.hasPendingNotice(), false);
  assert.equal(h.toast.textContent, REVOCATION_NOTICE);
  assert.equal(h.toast.classList.contains('hidden'), false);

  h.root.fire('focus');
  assert.equal(h.clicks, 0, 'repeated focus must remain a no-op after the one-shot notice');

  controller.destroy();
  assert.equal(h.root.listenerCount('blur'), 0);
  assert.equal(h.root.listenerCount('focus'), 0);
}

{
  const h = createHarness();
  h.attrs.set('aria-pressed', 'false');
  const controller = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  h.root.fire('blur');
  h.root.fire('focus');
  assert.equal(h.clicks, 0, 'inactive hands-free must not be toggled by focus lifecycle');
  assert.equal(controller.isRevoked(), false);
  controller.destroy();
}

console.log('hands-free window focus revocation tests passed');
