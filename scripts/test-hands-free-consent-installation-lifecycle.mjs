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
  const fixture = createConsentFixture(api);
  fixture.toggle.title = 'Host hands-free title';
  fixture.toggle.setAttribute('aria-describedby', 'host-help');
  fixture.toggle.setAttribute('data-consent-pending', 'host-pending');
  fixture.toggle.setAttribute('data-consent-blocked', 'host-blocked');
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), true);
  assert.equal(fixture.toggle.getAttribute('aria-describedby'), api.REVIEW_ID);
  assert.equal(fixture.toggle.getAttribute('data-consent-pending'), 'true');
  assert.equal(fixture.toggle.getAttribute('data-consent-blocked'), null);

  const keydown = fixture.documentEvent('keydown');
  let prevented = false;
  keydown({
    key: 'Escape',
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(controller.isPending(), false);
  assert.equal(fixture.toggle.getAttribute('aria-describedby'), 'host-help');

  controller.destroy();
  assert.equal(fixture.toggle.title, 'Host hands-free title');
  assert.equal(fixture.toggle.getAttribute('aria-describedby'), 'host-help');
  assert.equal(fixture.toggle.getAttribute('data-consent-pending'), 'host-pending');
  assert.equal(fixture.toggle.getAttribute('data-consent-blocked'), 'host-blocked');
  assert.equal(fixture.body.querySelector(`#${api.REVIEW_ID}`), null);
}

{
  const fixture = createConsentFixture(api);
  const first = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  assert.throws(
    () => api.installHandsFreeConsent(fixture.documentRef, fixture.root),
    /HANDS_FREE_CONSENT_ALREADY_INSTALLED/
  );

  first.destroy();
  const second = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  assert.ok(second, 'destroy releases installation ownership for a clean remount');
  second.destroy();
}

{
  const fixture = createConsentFixture(api, { collision: true });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  assert.equal(controller.isBlocked(), true);
  assert.equal(controller.getBlockReason(), 'review-collision');
  assert.equal(fixture.toggle.disabled, true);
  assert.equal(fixture.toggle.getAttribute('data-consent-blocked'), 'review-collision');

  assert.throws(
    () => api.installHandsFreeConsent(fixture.documentRef, fixture.root),
    /HANDS_FREE_CONSENT_ALREADY_INSTALLED/
  );

  controller.destroy();
  assert.equal(fixture.toggle.disabled, false);
}

{
  const fixture = createConsentFixture(api, { failMount: true });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  assert.equal(controller.isBlocked(), true);
  assert.equal(controller.getBlockReason(), 'review-mount-failed');
  assert.equal(fixture.toggle.disabled, true);
  assert.equal(fixture.body.querySelector(`#${api.REVIEW_ID}`), null);

  controller.destroy();
  assert.equal(fixture.toggle.disabled, false);
  assert.equal(fixture.toggle.getAttribute('data-consent-blocked'), null);
}

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), true);
  assert.equal(fixture.timers.size, 1);

  fixture.documentRef.hidden = true;
  fixture.documentEvent('visibilitychange')();
  assert.equal(controller.isPending(), false, 'hiding the document closes pending consent');
  assert.equal(fixture.timers.size, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { cancel } = reviewControls(api, fixture);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), true);
  dispatch(cancel, 'click', { isTrusted: false });
  assert.equal(controller.isPending(), false);
  assert.equal(fixture.toggle.focused, true, 'explicit cancel returns focus to the toggle');

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const toggleClickListenersBefore = fixture.toggle.listeners.get('click')?.length || 0;
  const keydownListenersBefore = fixture.documentListeners.get('keydown')?.length || 0;
  const visibilityListenersBefore = fixture.documentListeners.get('visibilitychange')?.length || 0;

  assert.ok(toggleClickListenersBefore > 0);
  assert.ok(keydownListenersBefore > 0);
  assert.ok(visibilityListenersBefore > 0);

  controller.destroy();
  assert.equal(fixture.toggle.listeners.get('click')?.length || 0, 0);
  assert.equal(fixture.documentListeners.get('keydown')?.length || 0, 0);
  assert.equal(fixture.documentListeners.get('visibilitychange')?.length || 0, 0);

  controller.destroy();
  assert.equal(fixture.body.querySelector(`#${api.REVIEW_ID}`), null, 'destroy is idempotent');
}

{
  const fixture = createConsentFixture(api);
  fixture.toggle.setAttribute('aria-pressed', 'true');
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);

  assert.equal(controller.begin(), false, 'programmatic begin cannot reopen consent while already enabled');
  assert.equal(controller.cancel(), false);
  controller.destroy();
}

console.log('hands-free consent installation lifecycle tests passed');
