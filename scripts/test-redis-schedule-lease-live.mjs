import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const redisUrl = typeof process.env.HAFIZE_TEST_REDIS_URL === 'string'
  ? process.env.HAFIZE_TEST_REDIS_URL.trim()
  : '';

if (!redisUrl) {
  console.log('live Redis schedule lease integration skipped (HAFIZE_TEST_REDIS_URL not set)');
  process.exit(0);
}

if (!/^rediss?:\/\//i.test(redisUrl)) {
  throw new Error('INVALID_HAFIZE_TEST_REDIS_URL');
}

const [redisModule, adapterModule, leaseModule] = await Promise.all([
  import('redis'),
  import('../lib/redis-schedule-lease-adapter.mjs'),
  import('../lib/schedule-execution-lease.mjs')
]);
const { createClient } = redisModule;
const { createRedisScheduleLeaseAdapter } = adapterModule;
const { createScheduleExecutionLeaseBoundary } = leaseModule;
if (typeof createClient !== 'function') throw new Error('REDIS_MODULE_UNAVAILABLE');

const clientA = createClient({ url: redisUrl });
const clientB = createClient({ url: redisUrl });
clientA.on('error', () => {});
clientB.on('error', () => {});

const nonce = randomUUID();
const keyPrefix = `hafize:test:lease:${nonce}`;
const scheduleId = `live_${nonce}`;
const expiryScheduleId = `live_expiry_${nonce}`;

function keysFor(schedule) {
  const tag = `{${schedule}}`;
  return [
    `${keyPrefix}:${tag}:lease`,
    `${keyPrefix}:${tag}:fence`,
    `${keyPrefix}:${tag}:completed`
  ];
}

const cleanupKeys = [
  ...keysFor(scheduleId),
  ...keysFor(expiryScheduleId)
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireAfterExpiry(worker, schedule, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await worker.acquire(schedule);
    if (result.status === 'acquired') return result;
    assert.equal(result.status, 'busy');
    await delay(100);
  }
  throw new Error('LIVE_REDIS_LEASE_EXPIRY_TIMEOUT');
}

async function closeClient(client) {
  if (!client?.isOpen) return;
  try {
    await client.quit();
  } catch {
    if (client.isOpen) client.disconnect();
  }
}

try {
  await Promise.all([clientA.connect(), clientB.connect()]);
  assert.equal(clientA.isReady, true);
  assert.equal(clientB.isReady, true);

  const adapterA = createRedisScheduleLeaseAdapter({ redis: clientA, keyPrefix });
  const adapterB = createRedisScheduleLeaseAdapter({ redis: clientB, keyPrefix });
  const workerA = createScheduleExecutionLeaseBoundary({
    adapter: adapterA,
    holderId: 'live-worker-a',
    leaseMs: 2_000,
    providerTimeoutMs: 500
  });
  const workerB = createScheduleExecutionLeaseBoundary({
    adapter: adapterB,
    holderId: 'live-worker-b',
    leaseMs: 2_000,
    providerTimeoutMs: 500
  });

  const acquired = await workerA.acquire(scheduleId);
  assert.equal(acquired.status, 'acquired');
  assert.equal(Number.isSafeInteger(acquired.fence), true);

  const busy = await workerB.acquire(scheduleId);
  assert.equal(busy.status, 'busy');
  assert.equal(Number.isNaN(new Date(busy.retryAt).getTime()), false);

  assert.deepEqual(
    await workerB.renew({ scheduleId, fence: acquired.fence }),
    { status: 'stale' }
  );
  assert.deepEqual(
    await workerB.complete({ scheduleId, fence: acquired.fence }),
    { status: 'stale' }
  );

  const renewed = await workerA.renew({ scheduleId, fence: acquired.fence });
  assert.equal(renewed.status, 'renewed');
  assert.equal(Number.isNaN(new Date(renewed.expiresAt).getTime()), false);

  assert.deepEqual(
    await workerA.complete({ scheduleId, fence: acquired.fence }),
    { status: 'completed' }
  );
  assert.deepEqual(
    await workerA.complete({ scheduleId, fence: acquired.fence }),
    { status: 'already_completed' }
  );

  const completed = await workerB.acquire(scheduleId);
  assert.deepEqual(completed, {
    status: 'completed',
    idempotencyKey: `schedule-execution:${scheduleId}`
  });

  const expiryWorkerA = createScheduleExecutionLeaseBoundary({
    adapter: adapterA,
    holderId: 'live-expiry-worker-a',
    leaseMs: 2_000,
    providerTimeoutMs: 500
  });
  const expiryWorkerB = createScheduleExecutionLeaseBoundary({
    adapter: adapterB,
    holderId: 'live-expiry-worker-b',
    leaseMs: 2_000,
    providerTimeoutMs: 500
  });

  const expiring = await expiryWorkerA.acquire(expiryScheduleId);
  assert.equal(expiring.status, 'acquired');
  const expiryBusy = await expiryWorkerB.acquire(expiryScheduleId);
  assert.equal(expiryBusy.status, 'busy');

  const reacquired = await acquireAfterExpiry(expiryWorkerB, expiryScheduleId);
  assert.equal(reacquired.fence > expiring.fence, true, 'reacquire must advance the fencing token');

  assert.deepEqual(
    await expiryWorkerA.renew({ scheduleId: expiryScheduleId, fence: expiring.fence }),
    { status: 'stale' }
  );
  assert.deepEqual(
    await expiryWorkerA.complete({ scheduleId: expiryScheduleId, fence: expiring.fence }),
    { status: 'stale' }
  );
  assert.deepEqual(
    await expiryWorkerB.complete({ scheduleId: expiryScheduleId, fence: reacquired.fence }),
    { status: 'completed' }
  );

  console.log('live Redis schedule lease integration passed');
} finally {
  if (clientA.isOpen) {
    try {
      await clientA.del(cleanupKeys);
    } catch {
      // Best-effort cleanup; never print the Redis URL or credential-bearing provider errors.
    }
  }
  await Promise.allSettled([closeClient(clientA), closeClient(clientB)]);
}
