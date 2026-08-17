import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const beginStart = source.indexOf('function begin()');
const beginEnd = source.indexOf('function onToggleCapture', beginStart);
const confirmStart = source.indexOf('function onConfirm');
const confirmEnd = source.indexOf('function onCancel', confirmStart);
const beginBody = source.slice(beginStart, beginEnd);
const confirmBody = source.slice(confirmStart, confirmEnd);

assert.match(beginBody, /!canReview\(documentRef, root, toggle\)/, 'begin must re-check visibility/security');
assert.match(confirmBody, /!canReview\(documentRef, root, toggle\)/, 'confirm must re-check visibility/security');
assert.ok(confirmBody.indexOf('!canReview') < confirmBody.indexOf('toggle.click?.();'), 'guard must precede handoff');
assert.match(source, /function onVisibility\(\)[\s\S]*documentRef\.hidden[\s\S]*cancel\(\)/);

// The helper protects both a hidden document and an explicitly insecure context.
assert.match(source, /documentRef\?\.hidden !== true/);
assert.match(source, /root\?\.isSecureContext !== false/);

// Review expiry and visibility cancellation are independent defenses.
assert.match(source, /root\.setTimeout\(expire, CONSENT_TIMEOUT_MS\)/);
assert.match(source, /addEventListener\?\.\('visibilitychange', onVisibility\)/);

console.log('hands-free consent hidden-race tests passed');
