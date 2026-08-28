import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  REVOKED_ATTR,
  installHandsFreeBackgroundGuard
} = require('../public/hands-free-background-guard.js');

function createToggle() {
  const attrs = new Map([['aria-pressed', 'true']]);
  let clickCount = 0;
  return {
    get clickCount() { return clickCount; },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    hasAttribute(name) { return attrs.has(name); },
    click() {
      clickCount += 1;
      throw new Error('SYNTHETIC_CONSENT_CLICK_FORBIDDEN');
    }
  };
}

function createRoot() {
  return {
    navigator: {},
    addEventListener() {},
    removeEventListener() {}
  };
}

{
  const toggle = createToggle();
  const listeners = new Map();
  const documentRef = {
    hidden: false,
    querySelector: (selector) => selector === '#handsFreeToggle' ? toggle : null,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {},
    dispatchEvent(event) {
      if (event.type === HANDS_FREE_REVOKE_EVENT) toggle.setAttribute('aria-pressed', 'false');
      return true;
    }
  };
  const controller = installHandsFreeBackgroundGuard(documentRef, createRoot());
  assert.equal(controller.revoke(), true, 'disable-only event transport can revoke an active session');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(toggle.clickCount, 0, 'successful revocation never synthesizes user consent interaction');
  controller.destroy();
}

{
  const toggle = createToggle();
  const documentRef = {
    hidden: false,
    querySelector: (selector) => selector === '#handsFreeToggle' ? toggle : null,
    addEventListener() {},
    removeEventListener() {}
  };
  const controller = installHandsFreeBackgroundGuard(documentRef, createRoot());
  assert.equal(controller.revoke(), false, 'missing event transport fails closed');
  assert.equal(controller.getLastReason(), 'revocation-failed');
  assert.equal(toggle.getAttribute(REVOKED_ATTR), 'revocation-failed');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true', 'failure never forges disabled runtime state');
  assert.equal(toggle.clickCount, 0, 'failure never falls back to toggle.click');
  controller.destroy();
}

console.log('hands-free event-only revocation tests passed');