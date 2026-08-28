import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  REVOKED_ATTR,
  isHandsFreeEnabled,
  installHandsFreeBackgroundGuard
} = require('../public/hands-free-background-guard.js');

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener, capture = false) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, capture: Boolean(capture) });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener, capture = false) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => (
      entry.listener !== listener || entry.capture !== Boolean(capture)
    )));
  }

  dispatch(type) {
    this.dispatchEvent({ type });
  }

  dispatchEvent(event) {
    const entries = [...(this.listeners.get(event?.type) || [])];
    for (const entry of entries.filter((item) => item.capture)) entry.listener(event);
    for (const entry of entries.filter((item) => !item.capture)) entry.listener(event);
    return true;
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }
}

function createHarness({ enabled = false, hidden = false, baselineRevoked, runtimeListener = true } = {}) {
  const documentRef = new FakeTarget();
  const root = new FakeTarget();
  const attrs = new Map();
  attrs.set('aria-pressed', String(enabled));
  if (baselineRevoked !== undefined) attrs.set(REVOKED_ATTR, baselineRevoked);

  let clickCount = 0;
  const toggle = {
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    hasAttribute(name) {
      return attrs.has(name);
    },
    click() {
      clickCount += 1;
      throw new Error('SYNTHETIC_CONSENT_CLICK_FORBIDDEN');
    }
  };

  documentRef.hidden = hidden;
  documentRef.querySelector = (selector) => selector === '#handsFreeToggle' ? toggle : null;
  if (runtimeListener) {
    documentRef.addEventListener(HANDS_FREE_REVOKE_EVENT, () => {
      toggle.setAttribute('aria-pressed', 'false');
    });
  }

  return {
    documentRef,
    root,
    toggle,
    attrs,
    get clickCount() { return clickCount; }
  };
}

{
  const harness = createHarness({ enabled: true });
  assert.equal(isHandsFreeEnabled(harness.toggle), true);
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  assert.ok(controller);
  assert.equal(harness.documentRef.listenerCount('visibilitychange'), 1);
  assert.equal(harness.documentRef.listenerCount('freeze'), 1);
  assert.equal(harness.root.listenerCount('pagehide'), 1);

  harness.documentRef.hidden = true;
  harness.documentRef.dispatch('visibilitychange');
  assert.equal(harness.clickCount, 0, 'hidden document must revoke without synthetic consent clicks');
  assert.equal(isHandsFreeEnabled(harness.toggle), false);
  assert.equal(controller.isRevoked(), true);
  assert.equal(controller.getLastReason(), 'hidden');
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), 'hidden');

  harness.documentRef.hidden = false;
  harness.documentRef.dispatch('visibilitychange');
  assert.equal(harness.clickCount, 0, 'returning visible must never auto-enable hands-free');
  assert.equal(isHandsFreeEnabled(harness.toggle), false);

  controller.destroy();
  assert.equal(harness.documentRef.listenerCount('visibilitychange'), 0);
  assert.equal(harness.documentRef.listenerCount('freeze'), 0);
  assert.equal(harness.root.listenerCount('pagehide'), 0);
  assert.equal(harness.toggle.hasAttribute(REVOKED_ATTR), false);
  assert.equal(controller.isRevoked(), false);
  assert.equal(controller.getLastReason(), '');
}

for (const reason of ['pagehide', 'freeze']) {
  const harness = createHarness({ enabled: true });
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  if (reason === 'pagehide') harness.root.dispatch('pagehide');
  else harness.documentRef.dispatch('freeze');
  assert.equal(harness.clickCount, 0);
  assert.equal(isHandsFreeEnabled(harness.toggle), false);
  assert.equal(controller.getLastReason(), reason);
  controller.destroy();
}

{
  const harness = createHarness({ enabled: true, hidden: true });
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  assert.equal(harness.clickCount, 0, 'already-hidden installation must fail closed without a click');
  assert.equal(isHandsFreeEnabled(harness.toggle), false);
  assert.equal(controller.getLastReason(), 'hidden-at-install');
  controller.destroy();
}

{
  const harness = createHarness({ enabled: false });
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.documentRef.hidden = true;
  harness.documentRef.dispatch('visibilitychange');
  harness.root.dispatch('pagehide');
  harness.documentRef.dispatch('freeze');
  assert.equal(harness.clickCount, 0, 'inactive hands-free must stay inactive');
  assert.equal(controller.isRevoked(), false);
  controller.destroy();
}

{
  const harness = createHarness({ enabled: true, baselineRevoked: 'host-value' });
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.root.dispatch('pagehide');
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), 'pagehide');
  controller.destroy();
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), 'host-value', 'destroy must restore host-owned state');
}

{
  const harness = createHarness();
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  assert.throws(
    () => installHandsFreeBackgroundGuard(harness.documentRef, harness.root),
    /HANDS_FREE_BACKGROUND_GUARD_ALREADY_INSTALLED/
  );
  controller.destroy();
  const replacement = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  assert.ok(replacement, 'destroy must release installation ownership');
  replacement.destroy();
}

{
  const documentRef = new FakeTarget();
  documentRef.querySelector = () => null;
  assert.equal(installHandsFreeBackgroundGuard(documentRef, new FakeTarget()), null);
}

{
  const harness = createHarness({ enabled: true, runtimeListener: false });
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.root.dispatch('pagehide');
  assert.equal(controller.getLastReason(), 'revocation-failed');
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), 'revocation-failed');
  assert.equal(isHandsFreeEnabled(harness.toggle), true, 'missing runtime listener must not fake a disabled state');
  assert.equal(harness.clickCount, 0, 'missing runtime listener must not synthesize a toggle click');
  controller.destroy();
}

{
  const harness = createHarness({ enabled: true });
  harness.documentRef.dispatchEvent = undefined;
  const controller = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.root.dispatch('pagehide');
  assert.equal(controller.getLastReason(), 'revocation-failed');
  assert.equal(isHandsFreeEnabled(harness.toggle), true);
  assert.equal(harness.clickCount, 0, 'missing event transport must fail closed without user-interaction synthesis');
  controller.destroy();
}

console.log('hands-free background guard tests passed');
