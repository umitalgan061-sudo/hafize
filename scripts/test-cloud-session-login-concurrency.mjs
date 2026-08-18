import assert from 'node:assert/strict';
import {
  createCloudSessionLoginConcurrencyGate,
  CLOUD_SESSION_LOGIN_CONCURRENCY_LIMITS
} from '../lib/cloud-session-login-concurrency.mjs';

const gate = createCloudSessionLoginConcurrencyGate();
assert.equal(gate.capacity, 2);
assert.equal(gate.activeCount(), 0);

const first = gate.begin();
const second = gate.begin();
assert.equal(first.ok, true);
assert.equal(second.ok, true);
assert.equal(gate.activeCount(), 2);

const busy = gate.begin();
assert.deepEqual(busy, {
  ok: false,
  status: 503,
  error: 'SESSION_AUTH_BUSY',
  retryAfterSeconds: 1
});
assert.equal(gate.activeCount(), 2);

assert.equal(first.complete(), true);
assert.equal(first.complete(), false);
assert.equal(gate.activeCount(), 1);

const replacement = gate.begin();
assert.equal(replacement.ok, true);
assert.equal(gate.activeCount(), 2);
assert.equal(second.complete(), true);
assert.equal(replacement.complete(), true);
assert.equal(gate.activeCount(), 0);

const single = createCloudSessionLoginConcurrencyGate({ maxConcurrent: 1, retryAfterSeconds: 7 });
const ticket = single.begin();
assert.equal(ticket.ok, true);
assert.deepEqual(single.begin(), {
  ok: false,
  status: 503,
  error: 'SESSION_AUTH_BUSY',
  retryAfterSeconds: 7
});
ticket.complete();
assert.equal(single.begin().ok, true);

const maximum = createCloudSessionLoginConcurrencyGate({ maxConcurrent: CLOUD_SESSION_LOGIN_CONCURRENCY_LIMITS.maxConcurrent });
const held = [];
for (let index = 0; index < CLOUD_SESSION_LOGIN_CONCURRENCY_LIMITS.maxConcurrent; index += 1) {
  held.push(maximum.begin());
}
assert.equal(maximum.begin().ok, false);
for (const item of held) item.complete();
assert.equal(maximum.activeCount(), 0);

for (const value of [0, -1, 17, 1.5, Number.NaN, '2']) {
  assert.throws(
    () => createCloudSessionLoginConcurrencyGate({ maxConcurrent: value }),
    /INVALID_CLOUD_SESSION_LOGIN_CONCURRENCY:maxConcurrent/
  );
}
for (const value of [0, 61, 1.5, '1']) {
  assert.throws(
    () => createCloudSessionLoginConcurrencyGate({ retryAfterSeconds: value }),
    /INVALID_CLOUD_SESSION_LOGIN_CONCURRENCY:retryAfterSeconds/
  );
}

assert.deepEqual(CLOUD_SESSION_LOGIN_CONCURRENCY_LIMITS, {
  defaultMaxConcurrent: 2,
  maxConcurrent: 16,
  defaultRetryAfterSeconds: 1
});

process.stdout.write('cloud session login concurrency gate tests passed\n');
