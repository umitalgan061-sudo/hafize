import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { FakeElement } from './hands-free-consent-test-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/hands-free-consent.js');

assert.equal(api.REVIEW_ID, 'handsFreeConsentReview');
assert.equal(api.CONSENT_TIMEOUT_MS, 15_000);
assert.equal(typeof api.canReview, 'function');
assert.equal(typeof api.createReview, 'function');
assert.equal(typeof api.isTrustedActivation, 'function');
assert.equal(typeof api.readNow, 'function');
assert.equal(typeof api.installHandsFreeConsent, 'function');

const documentRef = {
  createElement(tag) {
    return new FakeElement(tag);
  }
};

const review = api.createReview(documentRef);
assert.equal(Object.isFrozen(review), true);
assert.equal(review.panel.id, api.REVIEW_ID);
assert.equal(review.panel.getAttribute('role'), 'group');
assert.match(review.panel.getAttribute('aria-label'), /mikrofon izni/i);
assert.equal(review.panel.hidden, true);
assert.equal(review.confirm.type, 'button');
assert.equal(review.cancel.type, 'button');
assert.match(review.confirm.textContent, /onayla/i);
assert.match(review.cancel.textContent, /vazgeç/i);

const copy = review.panel.children.find((node) => node.tagName === 'P');
assert.ok(copy, 'consent review includes explanatory copy');
assert.match(copy.textContent, /Hafize/);
assert.match(copy.textContent, /30 dakika/i);
assert.match(copy.textContent, /otomatik gönderilmez/i);

const toggle = new FakeElement('button');
toggle.setAttribute('aria-pressed', 'false');
assert.equal(api.canReview({ hidden: false }, { isSecureContext: true }, toggle), true);
assert.equal(api.canReview({ hidden: true }, { isSecureContext: true }, toggle), false);
assert.equal(api.canReview({ hidden: false }, { isSecureContext: false }, toggle), false);
toggle.disabled = true;
assert.equal(api.canReview({ hidden: false }, { isSecureContext: true }, toggle), false);
toggle.disabled = false;
toggle.setAttribute('aria-pressed', 'true');
assert.equal(api.canReview({ hidden: false }, { isSecureContext: true }, toggle), false);

assert.equal(api.isTrustedActivation({ isTrusted: true }), true);
assert.equal(api.isTrustedActivation({ isTrusted: false }), false);
assert.equal(api.isTrustedActivation({}), false);
assert.equal(api.isTrustedActivation(null), false);

assert.equal(api.readNow({ Date: { now: () => 1234 } }), 1234);
const fallbackNow = api.readNow({ Date: { now: () => Number.NaN } });
assert.equal(Number.isFinite(fallbackNow), true);

console.log('hands-free consent policy contract tests passed');
