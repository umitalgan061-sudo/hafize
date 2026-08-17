import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const toggleStart = source.indexOf('function onToggleCapture');
const toggleEnd = source.indexOf('function onConfirm', toggleStart);
const body = source.slice(toggleStart, toggleEnd);

const activeCheck = body.indexOf("toggle.getAttribute?.('aria-pressed') === 'true'");
const prevent = body.indexOf('event?.preventDefault?.()');
assert.ok(activeCheck >= 0 && prevent > activeCheck, 'active microphone shutdown must bypass consent interception');
assert.match(body.slice(activeCheck, prevent), /cancel\(\)/);
assert.match(body.slice(activeCheck, prevent), /return;/);

const canReviewStart = source.indexOf('function canReview');
const canReviewEnd = source.indexOf('function installHandsFreeConsent', canReviewStart);
const canReview = source.slice(canReviewStart, canReviewEnd);
assert.match(canReview, /aria-pressed'\) !== 'true'/);

// Consent is only an enable guard. It must never make the safety-off path slower.
assert.doesNotMatch(body.slice(0, prevent), /setTimeout|confirm|review\.confirm/);
console.log('hands-free consent disable fast-path tests passed');
