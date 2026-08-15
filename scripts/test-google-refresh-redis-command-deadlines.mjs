import assert from 'node:assert/strict';
import { createGoogleRefreshLease, GOOGLE_REFRESH_LEASE_LIMITS } from '../lib/google-refresh-lease.mjs';

const OWNER = 'owner_command_deadline';
const never = () => new Promise(() => {});

function deadlineHarness() {
  const entries = [];
  return {
    entries,
    set(callback, ms) {
      assert.equal(ms, GOOGLE_REFRESH_LEASE_LIMITS.commandTimeoutMs);
      const entry = { active: true, callback };
      entries.push(entry);
      return entry;
    },
    clear(entry) { entry.active = false; },
    async next() {
      for (let i = 0; i < 20; i += 1) {
        const entry = entries.find((item) => item.active);
        if (entry) return entry;
        await Promise.resolve();
      }
      assert.fail('expected active Redis command deadline');
    },
    async fire(entry) {
      assert.equal(entry.active, true);
      entry.active = false;
      entry.callback();
      await Promise.resolve();
    }
  };
}

function clientFactory({ setImpl, evalImpl, counters }) {
  return () => ({
    isReady: false,
    isOpen: false,
    on() {},
    async connect() { this.isReady = this.isOpen = true; },
    async set(...args) { counters.set += 1; return setImpl?.(...args); },
    async eval(...args) { counters.eval += 1; return evalImpl?.(...args); },
    async close() { counters.close += 1; this.isReady = this.isOpen = false; },
    destroy() { counters.destroy += 1; this.isReady = this.isOpen = false; }
  });
}

function runtime({ createClient, deadlines, setTimer, clearTimer, setCommandTimer, clearCommandTimer }) {
  return createGoogleRefreshLease({
    redisUrl: 'redis://shared:6379/0',
    createClient,
    randomBytesImpl: () => Buffer.alloc(16, 4),
    setTimer,
    clearTimer,
    setCommandTimer: setCommandTimer || deadlines.set,
    clearCommandTimer: clearCommandTimer || deadlines.clear
  });
}

{
  const deadlines = deadlineHarness();
  const counters = { set: 0, eval: 0, close: 0, destroy: 0 };
  const leaseRuntime = runtime({
    deadlines,
    createClient: clientFactory({ setImpl: never, evalImpl: async () => 1, counters })
  });
  const pending = leaseRuntime.acquire({ ownerId: OWNER });
  const deadline = await deadlines.next();
  await deadlines.fire(deadline);
  await assert.rejects(pending, (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
  assert.equal(counters.set, 1);
  assert.equal(counters.destroy, 1, 'timed-out SET must destroy the suspect Redis client');
  await leaseRuntime.close();
  assert.equal(counters.close, 0, 'retired client must not be gracefully reused/closed later');
}

{
  const deadlines = deadlineHarness();
  let creates = 0;
  const counters = { set: 0, eval: 0, close: 0, destroy: 0 };
  const leaseRuntime = runtime({
    deadlines,
    createClient: () => {
      creates += 1;
      const failSet = creates === 1;
      return clientFactory({
        counters,
        setImpl: async () => {
          if (failSet) throw new Error('socket detail must be sanitized');
          return 'OK';
        },
        evalImpl: async () => 1
      })();
    }
  });
  await assert.rejects(
    () => leaseRuntime.acquire({ ownerId: OWNER }),
    (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE' && !error.message.includes('socket detail')
  );
  const lease = await leaseRuntime.acquire({ ownerId: OWNER });
  assert.equal(creates, 2, 'a failed command must retire the client so the next acquire reconnects');
  await lease.release();
  assert.equal(counters.destroy, 1);
  await leaseRuntime.close();
}

{
  const deadlines = deadlineHarness();
  const counters = { set: 0, eval: 0, close: 0, destroy: 0 };
  const leaseRuntime = runtime({
    deadlines,
    createClient: clientFactory({
      counters,
      setImpl: async () => 'OK',
      evalImpl: (script) => script.includes('PEXPIRE') ? never() : Promise.resolve(1)
    })
  });
  const lease = await leaseRuntime.acquire({ ownerId: OWNER });
  const renewing = lease.renew();
  const deadline = await deadlines.next();
  await deadlines.fire(deadline);
  await assert.rejects(renewing, (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
  const evalsAfterTimeout = counters.eval;
  await assert.rejects(() => lease.renew(), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
  assert.equal(counters.eval, evalsAfterTimeout, 'sticky failure must not send commands on a retired client');
  await lease.release();
  assert.equal(counters.eval, evalsAfterTimeout, 'release must use TTL safety net after client retirement');
  await leaseRuntime.close();
}

{
  const deadlines = deadlineHarness();
  const counters = { set: 0, eval: 0, close: 0, destroy: 0 };
  const leaseRuntime = runtime({
    deadlines,
    createClient: clientFactory({
      counters,
      setImpl: async () => 'OK',
      evalImpl: (script) => script.includes('DEL') ? never() : Promise.resolve(1)
    })
  });
  const lease = await leaseRuntime.acquire({ ownerId: OWNER });
  const releasing = lease.release();
  const deadline = await deadlines.next();
  await deadlines.fire(deadline);
  await releasing;
  assert.equal(counters.destroy, 1, 'release timeout must abort the client instead of blocking shutdown');
  await leaseRuntime.close();
}

{
  const deadlines = deadlineHarness();
  const counters = { set: 0, eval: 0, close: 0, destroy: 0 };
  const leaseRuntime = runtime({
    deadlines,
    createClient: clientFactory({ setImpl: async () => 'OK', evalImpl: async () => 1, counters }),
    setCommandTimer() { throw new Error('timer unavailable'); }
  });
  await assert.rejects(() => leaseRuntime.acquire({ ownerId: OWNER }), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
  assert.equal(counters.set, 0, 'Redis command must not start when its deadline cannot be armed');
  assert.equal(counters.destroy, 1);
  await leaseRuntime.close();
}

{
  const deadlines = deadlineHarness();
  const counters = { set: 0, eval: 0, close: 0, destroy: 0 };
  const leaseRuntime = runtime({
    deadlines,
    createClient: clientFactory({ setImpl: async () => 'OK', evalImpl: async () => 1, counters }),
    clearCommandTimer() { throw new Error('timer cleanup unavailable'); }
  });
  await assert.rejects(() => leaseRuntime.acquire({ ownerId: OWNER }), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
  assert.equal(counters.destroy, 1, 'uncertain deadline cleanup must fail closed and retire the client');
  await leaseRuntime.close();
}

console.log('Google refresh Redis command deadline tests passed');
