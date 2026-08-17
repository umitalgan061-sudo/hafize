import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const consent = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

const captureInstall = consent.indexOf("toggle.addEventListener?.('click', onToggleCapture, true)");
const confirmHandler = consent.indexOf('function onConfirm');
const handoff = consent.indexOf('toggle.click?.();', confirmHandler);
assert.ok(captureInstall > 0);
assert.ok(confirmHandler > 0 && handoff > confirmHandler);
assert.match(consent.slice(confirmHandler, handoff), /canReview\(documentRef, root, toggle\)/);
assert.match(consent.slice(confirmHandler, handoff), /pending = false/);
assert.match(consent.slice(confirmHandler, handoff), /clearTimer\(\)/);

const consentTag = index.indexOf('/hands-free-consent.js');
const runtimeTag = index.indexOf('/hands-free.js');
assert.ok(consentTag >= 0 && runtimeTag > consentTag, 'consent script must install before hands-free runtime');

console.log('hands-free consent activation-order tests passed');
