import assert from 'node:assert/strict';
import { createGoogleRefreshLease, GOOGLE_REFRESH_LEASE_LIMITS } from '../lib/google-refresh-lease.mjs';

const OWNER = 'owner_heartbeat_failures';

function statefulClient(state, hooks = {}) {
  return {
    isReady: false, isOpen: false, on() {},
    async connect() { this.isReady = this.isOpen = true; },
    async set(key, value, { NX, PX }) {
      if (NX && state.key) return null;
      state.key = key; state.value = value; state.expiry = PX;
      return 'OK';
    },
    async eval(script, { keys, arguments: args }) {
      hooks.onEval?.(script);
      if (script.includes('PEXPIRE')) await hooks.beforeRenew?.();
      if (keys[0] !== state.key || args[0] !== state.value) return 0;
      if (script.includes('PEXPIRE')) { state.expiry = Number(args[1]); return 1; }
      state.key = null; state.value = null; state.expiry = 0;
      return 1;
    },
    async close() { this.isReady = this.isOpen = false; },
    destroy() { this.isReady = this.isOpen = false; }
  };
}

function makeRuntime({ state, createClient, setTimer, clearTimer = () => {}, random = 1 }) {
  return createGoogleRefreshLease({
    redisUrl: 'redis://shared:6379/0',
    createClient: createClient || (() => statefulClient(state)),
    now: () => 1_000,
    sleep: async () => {},
    randomBytesImpl: () => Buffer.alloc(16, random),
    setTimer,
    clearTimer
  });
}

{
  const state = { key: null, value: null, expiry: 0 };
  let heartbeat;
  let cleared = 0;
  let evals = 0;
  const runtime = makeRuntime({
    state,
    createClient: () => statefulClient(state, { onEval() { evals += 1; } }),
    setTimer(callback) { heartbeat = callback; return 11; },
    clearTimer() { cleared += 1; }
  });
  const lease = await runtime.acquire({ ownerId: OWNER });
  const successor = 'successor-holder-token';
  state.value = successor;
  await heartbeat();
  await assert.rejects(() => lease.renew(), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_LOST');
  await assert.rejects(() => lease.renew(), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_LOST');
  assert.equal(evals, 1, 'sticky lost state must not keep hitting Redis');
  assert.equal(cleared, 0, 'fired timer is already detached when heartbeat detects loss');
  await lease.release();
  assert.equal(state.value, successor, 'old holder release must never delete a successor lease');
  await runtime.close();
}

{
  const state = { key: null, value: null, expiry: 0 };
  let heartbeat;
  let timerCalls = 0;
  let renewEvals = 0;
  const runtime = makeRuntime({
    state,
    createClient: () => statefulClient(state, {
      onEval(script) { if (script.includes('PEXPIRE')) renewEvals += 1; }
    }),
    setTimer(callback) {
      timerCalls += 1;
      if (timerCalls === 1) { heartbeat = callback; return 21; }
      throw new Error('timer unavailable');
    }
  });
  const lease = await runtime.acquire({ ownerId: OWNER });
  await heartbeat();
  assert.equal(renewEvals, 1, 'first heartbeat renews before rescheduling');
  await assert.rejects(() => lease.renew(), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
  assert.equal(renewEvals, 1, 'timer failure becomes sticky and blocks later mutation guards');
  await lease.release();
  assert.equal(state.key, null);
  await runtime.close();
}

{
  const state = { key: null, value: null, expiry: 0 };
  let releaseEvals = 0;
  const runtime = makeRuntime({
    state,
    createClient: () => statefulClient(state, {
      onEval(script) { if (!script.includes('PEXPIRE')) releaseEvals += 1; }
    }),
    setTimer() { throw new Error('timer unavailable'); }
  });
  await assert.rejects(() => runtime.acquire({ ownerId: OWNER }), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
  assert.equal(releaseEvals, 1, 'failed initial heartbeat scheduling must release the just-acquired key');
  assert.equal(state.key, null, 'timer setup failure must not leave an orphan lease');
  await runtime.close();
}

{
  const state = { key: null, value: null, expiry: 0 };
  let heartbeat;
  let renewEvals = 0;
  let activeRenewals = 0;
  let maxActiveRenewals = 0;
  let startRenew;
  const renewStarted = new Promise((resolve) => { startRenew = resolve; });
  let finishRenew;
  const renewGate = new Promise((resolve) => { finishRenew = resolve; });
  const runtime = makeRuntime({
    state,
    createClient: () => statefulClient(state, {
      onEval(script) { if (script.includes('PEXPIRE')) renewEvals += 1; },
      async beforeRenew() {
        activeRenewals += 1;
        maxActiveRenewals = Math.max(maxActiveRenewals, activeRenewals);
        startRenew();
        await renewGate;
        activeRenewals -= 1;
      }
    }),
    setTimer(callback) { heartbeat = callback; return 31; }
  });
  const lease = await runtime.acquire({ ownerId: OWNER });
  const heartbeatRun = heartbeat();
  await renewStarted;
  const manualRenew = lease.renew();
  await Promise.resolve();
  assert.equal(renewEvals, 1, 'heartbeat and manual guard must share one in-flight renew');
  finishRenew();
  await Promise.all([heartbeatRun, manualRenew]);
  assert.equal(maxActiveRenewals, 1, 'renew operations must be serialized per holder');
  await lease.release();
  await runtime.close();
}

assert.ok(GOOGLE_REFRESH_LEASE_LIMITS.heartbeatMs * 2 < GOOGLE_REFRESH_LEASE_LIMITS.leaseMs,
  'heartbeat must leave more than one interval of TTL safety margin');
assert.ok(GOOGLE_REFRESH_LEASE_LIMITS.waitMs > GOOGLE_REFRESH_LEASE_LIMITS.leaseMs,
  'wait budget must outlive one dead-holder TTL');

console.log('Google refresh lease failure-mode tests passed');
