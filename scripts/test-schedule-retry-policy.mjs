import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const retry = require('../public/schedule-retry-policy.js');

assert.equal(retry.MAX_SCHEDULE_ID_CHARS, 120);
assert.equal(retry.AUTO_MOUNT_TIMEOUT_MS, 10_000);
assert.deepEqual(retry.RETRY_OPTIONS.map((item) => item.value), [
  60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000
]);
assert.equal(retry.normalizeScheduleId(' schedule_12 '), 'schedule_12');
assert.equal(retry.normalizeScheduleId('../x'), null);
assert.equal(retry.normalizeScheduleId('x'.repeat(121)), null);
assert.equal(retry.schedulePath('schedule_12'), '/api/schedules/schedule_12');
assert.equal(retry.schedulePath('../x'), null);
assert.equal(retry.normalizeRetryDelay('60000'), 60_000);
assert.equal(retry.normalizeRetryDelay(300_000), 300_000);
assert.equal(retry.normalizeRetryDelay(1_000), null);
assert.equal(retry.normalizeRetryDelay(86_400_001), null);
assert.equal(retry.normalizeRetryDelay('not-a-number'), null);

const eligible = { dataset: { state: 'scheduled', scheduleId: 'schedule_1', maxAttempts: '3' } };
assert.equal(retry.maxAttemptsFor(eligible), 3);
assert.equal(retry.isEligibleArticle(eligible), true);
assert.equal(retry.isEligibleArticle({ dataset: { state: 'scheduled', scheduleId: 'schedule_1', maxAttempts: '1' } }), false);
assert.equal(retry.isEligibleArticle({ dataset: { state: 'running', scheduleId: 'schedule_1', maxAttempts: '3' } }), false);
assert.equal(retry.isEligibleArticle({ dataset: { state: 'scheduled', scheduleId: '../x', maxAttempts: '3' } }), false);

let captured = null;
const client = retry.createClient({
  fetchImpl: async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, async json() { return { ok: true }; } };
  }
});
const result = await client.update('schedule_4', 900_000);
assert.equal(result.ok, true);
assert.equal(captured.url, '/api/schedules/schedule_4');
assert.equal(captured.options.method, 'PATCH');
assert.equal(captured.options.credentials, 'same-origin');
assert.equal(captured.options.cache, 'no-store');
assert.deepEqual(JSON.parse(captured.options.body), { retryDelayMs: 900_000 });

let calls = 0;
const invalidClient = retry.createClient({ fetchImpl: async () => { calls += 1; throw new Error('must not run'); } });
const invalid = await invalidClient.update('schedule_4', 12_345);
assert.equal(invalid.ok, false);
assert.equal(calls, 0, 'invalid retry delays must fail before network');

console.log('schedule retry policy helper tests passed');
