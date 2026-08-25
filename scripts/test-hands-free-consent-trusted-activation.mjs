import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  createConsentFixture,
  dispatch,
  reviewControls
} from './hands-free-consent-test-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/hands-free-consent.js');

assert.equal(api.CONSENT_TIMEOUT_MS, 15_000);
assert.equal(api.isTrustedActivation(null), false);
assert.equal(api.isTrustedActivation({ isTrusted: false }), false);
assert.equal(api.isTrustedActivation({ isTrusted: true }), true);

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { panel } = reviewControls(api, fixture);

  assert.ok(controller);
  assert.equal(controller.isBlocked(), false);
  assert.equal(controller.isPending(), false);
  assert.equal(panel.hidden, true);

  const synthetic = dispatch(fixture.toggle, 'click', { isTrusted: false });
  assert.equal(synthetic.prevented, true);
  assert.equal(synthetic.stopped, true);
  assert.equal(controller.isPending(), false, 'synthetic toggle cannot open consent');
  assert.equal(panel.hidden, true);
  assert.equal(fixture.timers.size, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { panel, confirm } = reviewControls(api, fixture);

  const trusted = dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(trusted.prevented, true);
  assert.equal(trusted.stopped, true);
  assert.equal(controller.isPending(), true);
  assert.equal(panel.hidden, false);
  assert.equal(fixture.toggle.getAttribute('aria-describedby'), api.REVIEW_ID);
  assert.equal(fixture.timers.size, 1);

  dispatch(confirm, 'click', { isTrusted: false });
  assert.equal(controller.isPending(), true, 'synthetic confirm cannot grant consent');
  assert.equal(panel.hidden, false);
  assert.equal(fixture.toggle.clickCount, 0);

  dispatch(confirm, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), false);
  assert.equal(panel.hidden, true);
  assert.equal(fixture.toggle.clickCount, 1, 'trusted confirm forwards exactly one toggle click');
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.toggle.getAttribute('aria-describedby'), null);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { confirm } = reviewControls(api, fixture);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  dispatch(confirm, 'click', { isTrusted: true });
  assert.equal(fixture.toggle.clickCount, 1);

  dispatch(fixture.toggle, 'click', { isTrusted: false });
  assert.equal(controller.isPending(), false, 'one-shot bypass cannot be reused later');
  assert.equal(fixture.toggle.clickCount, 1);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const { cancel } = reviewControls(api, fixture);

  dispatch(fixture.toggle, 'click', { isTrusted: true });
  assert.equal(controller.isPending(), true);
  dispatch(cancel, 'click', { isTrusted: false });
  assert.equal(controller.isPending(), false, 'cancel is always allowed because it only reduces permission');
  assert.equal(fixture.toggle.clickCount, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api, { secure: false });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  const result = dispatch(fixture.toggle, 'click', { isTrusted: true });

  assert.equal(result.prevented, false, 'blocked consent installs no activation interceptor');
  assert.equal(result.stopped, false);
  assert.equal(controller.isBlocked(), true);
  assert.equal(controller.getBlockReason(), 'insecure-context');
  assert.equal(controller.isPending(), false, 'insecure context cannot reach consent-ready state');
  assert.equal(fixture.toggle.disabled, true);
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.toggle.clickCount, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api, { hidden: true });
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  dispatch(fixture.toggle, 'click', { isTrusted: true });

  assert.equal(controller.isPending(), false, 'hidden document cannot begin microphone consent');
  assert.equal(fixture.timers.size, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  fixture.toggle.disabled = true;
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  dispatch(fixture.toggle, 'click', { isTrusted: true });

  assert.equal(controller.isPending(), false, 'disabled hands-free control cannot open consent');
  assert.equal(fixture.timers.size, 0);

  controller.destroy();
}

{
  const fixture = createConsentFixture(api);
  fixture.toggle.setAttribute('aria-pressed', 'true');
  const controller = api.installHandsFreeConsent(fixture.documentRef, fixture.root);
  dispatch(fixture.toggle, 'click', { isTrusted: false });

  assert.equal(controller.isPending(), false, 'already-enabled mode never opens a new consent panel');
  assert.equal(fixture.timers.size, 0);

  controller.destroy();
}

console.log('hands-free trusted activation tests passed');
