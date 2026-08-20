import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  createConsentFixture,
  dispatch,
  reviewControls
} from './hands-free-consent-test-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/hands-free-consent.js');

{
  const start = 5_000;
  const fixture = createConsentFixture(api, { now: start });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { confirm } = reviewControls(api, fixture);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), true);
  const timerId = [...fixture.timers.keys()][0];
  assert.ok(timerId);
  assert.equal(fixture.timers.get(timerId).delay, api.CONSENT_TIMEOUT_MS);

  fixture.setNow(start + api.CONSENT_TIMEOUT_MS - 1);
  dispatch(confirm, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), false);
  assert.equal(fixture.toggle.clickCount, 1, 'consent just before the absolute deadline is valid');

  controller.destroy();
}

{
  const start = 10_000;
  const fixture = createConsentFixture(api, { now: start });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { confirm } = reviewControls(api, fixture);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), true);

  fixture.setNow(start + api.CONSENT_TIMEOUT_MS);
  dispatch(confirm, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), false, 'deadline is enforced even if the browser timer was delayed');
  assert.equal(fixture.toggle.clickCount, 0, 'expired consent never forwards to the microphone toggle');
  assert.equal(fixture.timers.size, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  const timerId = [...fixture.timers.keys()][0];
  assert.equal(controller.isPending(), true);
  assert.equal(fixture.fireTimer(timerId), true);
  assert.equal(controller.isPending(), false);
  assert.equal(fixture.toggle.getAttribute('aria-describedby'), null);
  assert.equal(fixture.toggle.clickCount, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api, {
    setTimeoutImpl() {
      throw new Error('timer unavailable');
    }
  });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { panel } = reviewControls(api, fixture);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), false, 'timer-arm failure leaves consent closed');
  assert.equal(panel.hidden, true);
  assert.equal(fixture.toggle.getAttribute('aria-describedby'), null);
  assert.equal(fixture.toggle.clickCount, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api, {
    setTimeoutImpl() {
      return null;
    }
  });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), false, 'unarmed timeout fails closed');
  assert.equal(fixture.toggle.clickCount, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  fixture.root.setTimeout = null;
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  assert.equal(controller.isBlocked(), true);
  assert.equal(controller.getBlockReason(), 'timer-unavailable');
  assert.equal(fixture.toggle.disabled, true);
  assert.equal(fixture.toggle.getAttribute('data-consent-blocked'), 'timer-unavailable');
  assert.equal(controller.begin(), false);

  controller.destroy();
  assert.equal(fixture.toggle.disabled, false);
  assert.equal(fixture.toggle.getAttribute('data-consent-blocked'), null);
}

{
  const fixture = createConsentFixture(api);
  fixture.root.clearTimeout = null;
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  assert.equal(controller.isBlocked(), true);
  assert.equal(controller.getBlockReason(), 'timer-unavailable');
  controller.destroy();
}

{
  const fixture = createConsentFixture(api, { now: 42 });
  assert.equal(api.readNow(fixture.root), 42);
  fixture.root.Date.now = () => Number.NaN;
  assert.ok(Number.isFinite(api.readNow(fixture.root)));
}

console.log('hands-free consent deadline tests passed');
