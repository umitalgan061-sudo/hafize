import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'public/typed/platform-runtime.ts'), 'utf8');
const expected = [
  'storage', 'storageEstimate', 'serviceWorker', 'speechSynthesis', 'speechRecognition',
  'screenCapture', 'clipboard', 'webTransport', 'trustedTypes', 'performanceObserver', 'idleCallback'
];

for (const name of expected) assert.match(source, new RegExp(`\\b${name}\\b`), `capability missing: ${name}`);
assert.ok(source.includes("typeof navigator === 'undefined' ? null : navigator"));
assert.ok(source.includes("typeof navigatorRef.storage.estimate === 'function'"));
assert.ok(source.includes("typeof navigatorRef.mediaDevices.getDisplayMedia === 'function'"));
assert.ok(source.includes("typeof navigatorRef.clipboard?.writeText"));
assert.ok(source.includes("'trustedTypes' in windowRef"));
assert.ok(source.includes("typeof windowRef.PerformanceObserver === 'function'"));
assert.ok(source.includes("typeof windowRef.requestIdleCallback === 'function'"));

for (const forbidden of ['navigator.serviceWorker.register', 'Notification.requestPermission', 'geolocation.getCurrentPosition']) {
  assert.ok(!source.includes(forbidden), `runtime must not request permission: ${forbidden}`);
}
console.log('platform capabilities: ok');
