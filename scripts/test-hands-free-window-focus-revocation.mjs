import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { installHandsFreeBackgroundGuard, REVOCATION_NOTICE } = require('../public/hands-free-background-guard.js');

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
  fire(type) {
    for (const item of [...(this.listeners.get(type) || [])]) item.fn({ type });
  }
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
      attrs.set('aria-pressed', attrs.get('aria-pressed') === 'true' ? 'false' : 'true');
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
  return { documentRef, root, toggle, toast, attrs, get clicks() { return clicks; } };
}

{
  const h = createHarness();
  const controller = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  assert.equal(h.root.listenerCount('blur'), 1);
  assert.equal(h.root.listenerCount('focus'), 1);

  h.root.fire('blur');
  assert.equal(h.clicks, 1, 'window blur must revoke the active hands-free session');
  assert.equal(h.attrs.get('aria-pressed'), 'false');
  assert.equal(controller.getLastReason(), 'window-blur');
  assert.equal(controller.hasPendingNotice(), true);

  h.root.fire('focus');
  assert.equal(h.clicks, 1, 'focus must never re-enable hands-free');
  assert.equal(controller.hasPendingNotice(), false);
  assert.equal(h.toast.textContent, REVOCATION_NOTICE);
  assert.equal(h.toast.classList.contains('hidden'), false);

  h.root.fire('focus');
  assert.equal(h.clicks, 1, 'repeated focus must remain a no-op after the one-shot notice');

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