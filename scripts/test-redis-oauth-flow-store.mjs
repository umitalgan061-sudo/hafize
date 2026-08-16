import assert from 'node:assert/strict';
import { createRedisOAuthFlowStore, OAUTH_REDIS_FLOW_LIMITS } from '../lib/redis-oauth-flow-store.mjs';

const BASE_FLOW = {
  state: 's'.repeat(43), verifier: 'v'.repeat(64), provider: 'google',
  redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['openid', 'email']
};

function fakeRedis() {
  const values = new Map();
  const index = new Map();
  const commands = [];
  let clock = 1_000;

  function purge() {
    for (const [key, entry] of values) if (entry.expiresAt <= clock) values.delete(key);
    for (const [digest, expiry] of index) if (expiry <= clock) index.delete(digest);
  }

  function client() {
    return {
      isReady: true,
      async eval(script, { keys, arguments: args }) {
        commands.push({ keys: [...keys], arguments: [...args] });
        purge();
        if (script.includes('ZREMRANGEBYSCORE')) {
          const [ttlRaw, capacityRaw, payload, digest] = args;
          const ttl = Number(ttlRaw);
          const capacity = Number(capacityRaw);
          const key = keys[1];
          if (values.has(key)) return -1;
          if (index.size >= capacity) return -2;
          const expiry = clock + ttl;
          values.set(key, { value: payload, expiresAt: expiry });
          index.set(digest, expiry);
          return expiry;
        }
        const digest = args[0];
        const entry = values.get(keys[1]);
        index.delete(digest);
        if (!entry) return false;
        values.delete(keys[1]);
        return entry.value;
      },
      destroy() { this.isReady = false; }
    };
  }

  return {
    client, commands, values,
    advance(ms) { clock += ms; },
    corruptOnlyValue(value) {
      const key = [...values.keys()][0];
      assert.ok(key);
      values.get(key).value = value;
    }
  };
}

{
  const shared = fakeRedis();
  const storeA = createRedisOAuthFlowStore({ client: shared.client(), ttlMs: 500, maxFlows: 4 });
  const storeB = createRedisOAuthFlowStore({ client: shared.client(), ttlMs: 500, maxFlows: 4 });
  await storeA.issue(BASE_FLOW);
  const consumed = await storeB.consume(BASE_FLOW.state);
  assert.equal(consumed.provider, 'google');
  assert.equal(consumed.verifier, BASE_FLOW.verifier);
  assert.deepEqual(consumed.scopes, BASE_FLOW.scopes);
  await assert.rejects(() => storeA.consume(BASE_FLOW.state), (error) => error?.code === 'OAUTH_FLOW_NOT_FOUND');
  assert.equal(JSON.stringify(shared.commands).includes(BASE_FLOW.state), false, 'raw OAuth state must not appear in Redis keys or payload');
}

{
  const shared = fakeRedis();
  const storeA = createRedisOAuthFlowStore({ client: shared.client(), ttlMs: 100, maxFlows: 2 });
  const storeB = createRedisOAuthFlowStore({ client: shared.client(), ttlMs: 100, maxFlows: 2 });
  const a = { ...BASE_FLOW, state: 'a'.repeat(43) };
  const b = { ...BASE_FLOW, state: 'b'.repeat(43) };
  const c = { ...BASE_FLOW, state: 'c'.repeat(43) };
  assert.deepEqual(await storeA.issue(a), { state: a.state, expiresAt: 1_100 });
  await storeB.issue(b);
  await assert.rejects(() => storeA.issue(c), (error) => error?.code === 'OAUTH_FLOW_STORE_FULL');
  await assert.rejects(() => storeB.issue(a), (error) => error?.code === 'OAUTH_FLOW_STATE_COLLISION');
  shared.advance(101);
  assert.equal((await storeA.issue(c)).expiresAt, 1_201, 'expired flows must free shared capacity');
}

{
  const shared = fakeRedis();
  const store = createRedisOAuthFlowStore({ client: shared.client() });
  await store.issue(BASE_FLOW);
  shared.corruptOnlyValue('{"verifier":"broken"}');
  await assert.rejects(() => store.consume(BASE_FLOW.state), (error) => error?.code === 'OAUTH_FLOW_STORE_CORRUPT');
  await assert.rejects(() => store.consume(BASE_FLOW.state), (error) => error?.code === 'OAUTH_FLOW_NOT_FOUND');
}

{
  let evals = 0;
  let destroys = 0;
  const store = createRedisOAuthFlowStore({
    client: {
      isReady: true,
      async eval() { evals += 1; throw new Error('redis secret socket detail'); },
      destroy() { destroys += 1; this.isReady = false; }
    }
  });
  await assert.rejects(() => store.issue(BASE_FLOW), (error) =>
    error?.code === 'OAUTH_FLOW_STORE_UNAVAILABLE' && !error.message.includes('socket detail'));
  await assert.rejects(() => store.issue({ ...BASE_FLOW, state: 'x'.repeat(43) }), (error) => error?.code === 'OAUTH_FLOW_STORE_UNAVAILABLE');
  assert.equal(evals, 1, 'failed Redis client must become sticky-unavailable');
  assert.equal(destroys, 1);
}

{
  let deadline;
  let destroys = 0;
  const store = createRedisOAuthFlowStore({
    client: {
      isReady: true,
      eval() { return new Promise(() => {}); },
      destroy() { destroys += 1; this.isReady = false; }
    },
    setTimer(callback, ms) {
      assert.equal(ms, OAUTH_REDIS_FLOW_LIMITS.commandTimeoutMs);
      deadline = callback;
      return 1;
    },
    clearTimer() {}
  });
  const pending = store.issue(BASE_FLOW);
  await Promise.resolve();
  assert.equal(typeof deadline, 'function');
  deadline();
  await assert.rejects(pending, (error) => error?.code === 'OAUTH_FLOW_STORE_UNAVAILABLE');
  assert.equal(destroys, 1, 'hung Redis command must retire the client');
}

assert.throws(() => createRedisOAuthFlowStore({ client: {} }), /INVALID_OAUTH_REDIS_STORE_CLIENT/);
console.log('Redis OAuth flow store tests passed');
