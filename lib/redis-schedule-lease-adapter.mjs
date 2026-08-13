const KEY_PREFIX_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60_000;

const ACQUIRE_SCRIPT = `-- hafize:acquire
local completed = redis.call('GET', KEYS[3])
if completed then return {'completed'} end
local now = redis.call('TIME')
local nowMs = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
local current = redis.call('GET', KEYS[1])
if current then
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl > 0 then return {'busy', tostring(nowMs + ttl)} end
  redis.call('DEL', KEYS[1])
end
local fence = redis.call('INCR', KEYS[2])
local token = ARGV[1] .. '|' .. tostring(fence)
redis.call('SET', KEYS[1], token, 'PX', ARGV[2])
return {'acquired', tostring(fence), tostring(nowMs + tonumber(ARGV[2]))}`;

const RENEW_SCRIPT = `-- hafize:renew
if redis.call('GET', KEYS[3]) then return {'completed'} end
local token = ARGV[1] .. '|' .. ARGV[2]
if redis.call('GET', KEYS[1]) ~= token then return {'stale'} end
local now = redis.call('TIME')
local nowMs = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return {'renewed', tostring(nowMs + tonumber(ARGV[3]))}`;

const COMPLETE_SCRIPT = `-- hafize:complete
if redis.call('GET', KEYS[3]) then return {'already_completed'} end
local token = ARGV[1] .. '|' .. ARGV[2]
if redis.call('GET', KEYS[1]) ~= token then return {'stale'} end
redis.call('SET', KEYS[3], ARGV[3])
redis.call('DEL', KEYS[1])
return {'completed'}`;

const RELEASE_SCRIPT = `-- hafize:release
if redis.call('GET', KEYS[3]) then return {'completed'} end
local token = ARGV[1] .. '|' .. ARGV[2]
if redis.call('GET', KEYS[1]) ~= token then return {'stale'} end
redis.call('DEL', KEYS[1])
return {'released'}`;

function cleanId(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!ID_PATTERN.test(text)) throw new Error(`INVALID_REDIS_SCHEDULE_LEASE:${label}`);
  return text;
}

function cleanPrefix(value) {
  const prefix = typeof value === 'string' ? value.trim() : '';
  if (!KEY_PREFIX_PATTERN.test(prefix)) throw new Error('INVALID_REDIS_SCHEDULE_LEASE:keyPrefix');
  return prefix;
}

function cleanLeaseMs(value) {
  if (!Number.isInteger(value) || value < MIN_LEASE_MS || value > MAX_LEASE_MS) {
    throw new Error('INVALID_REDIS_SCHEDULE_LEASE:leaseMs');
  }
  return value;
}

function cleanFence(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('INVALID_REDIS_SCHEDULE_LEASE:fence');
  return value;
}

function cleanEpoch(value, label) {
  const epoch = Number(value);
  if (!Number.isSafeInteger(epoch) || epoch <= 0) throw new Error(`REDIS_SCHEDULE_LEASE_INVALID_RESPONSE:${label}`);
  return new Date(epoch).toISOString();
}

function cleanResult(value) {
  if (!Array.isArray(value) || typeof value[0] !== 'string') {
    throw new Error('REDIS_SCHEDULE_LEASE_INVALID_RESPONSE');
  }
  return value;
}

function keysFor(prefix, scheduleId) {
  const tag = `{${scheduleId}}`;
  return [
    `${prefix}:${tag}:lease`,
    `${prefix}:${tag}:fence`,
    `${prefix}:${tag}:completed`
  ];
}

async function evalRedis(redis, script, keys, args) {
  try {
    return await redis.eval(script, { keys, arguments: args.map(String) });
  } catch {
    throw new Error('REDIS_SCHEDULE_LEASE_FAILED');
  }
}

export function createRedisScheduleLeaseAdapter({ redis, keyPrefix = 'hafize:schedule-lease' } = {}) {
  if (typeof redis?.eval !== 'function') throw new Error('INVALID_REDIS_SCHEDULE_LEASE:redis');
  const prefix = cleanPrefix(keyPrefix);

  async function acquire({ scheduleId, holderId, leaseMs } = {}) {
    const id = cleanId(scheduleId, 'scheduleId');
    const holder = cleanId(holderId, 'holderId');
    const ttl = cleanLeaseMs(leaseMs);
    const result = cleanResult(await evalRedis(redis, ACQUIRE_SCRIPT, keysFor(prefix, id), [holder, ttl]));
    if (result[0] === 'acquired') {
      const fence = Number(result[1]);
      if (!Number.isSafeInteger(fence) || fence < 1) throw new Error('REDIS_SCHEDULE_LEASE_INVALID_RESPONSE:fence');
      return { status: 'acquired', fence, expiresAt: cleanEpoch(result[2], 'expiresAt') };
    }
    if (result[0] === 'busy') return { status: 'busy', retryAt: cleanEpoch(result[1], 'retryAt') };
    if (result[0] === 'completed') return { status: 'completed' };
    throw new Error('REDIS_SCHEDULE_LEASE_INVALID_RESPONSE:status');
  }

  async function renew({ scheduleId, holderId, fence, leaseMs } = {}) {
    const id = cleanId(scheduleId, 'scheduleId');
    const holder = cleanId(holderId, 'holderId');
    const safeFence = cleanFence(fence);
    const ttl = cleanLeaseMs(leaseMs);
    const result = cleanResult(await evalRedis(redis, RENEW_SCRIPT, keysFor(prefix, id), [holder, safeFence, ttl]));
    if (result[0] === 'renewed') return { status: 'renewed', expiresAt: cleanEpoch(result[1], 'expiresAt') };
    if (result[0] === 'stale' || result[0] === 'completed') return { status: result[0] };
    throw new Error('REDIS_SCHEDULE_LEASE_INVALID_RESPONSE:status');
  }

  async function complete({ scheduleId, holderId, fence, idempotencyKey } = {}) {
    const id = cleanId(scheduleId, 'scheduleId');
    const holder = cleanId(holderId, 'holderId');
    const safeFence = cleanFence(fence);
    const idempotency = cleanId(idempotencyKey, 'idempotencyKey');
    const result = cleanResult(await evalRedis(redis, COMPLETE_SCRIPT, keysFor(prefix, id), [holder, safeFence, idempotency]));
    if (result[0] === 'completed' || result[0] === 'already_completed' || result[0] === 'stale') {
      return { status: result[0] };
    }
    throw new Error('REDIS_SCHEDULE_LEASE_INVALID_RESPONSE:status');
  }

  async function release({ scheduleId, holderId, fence } = {}) {
    const id = cleanId(scheduleId, 'scheduleId');
    const holder = cleanId(holderId, 'holderId');
    const safeFence = cleanFence(fence);
    const result = cleanResult(await evalRedis(redis, RELEASE_SCRIPT, keysFor(prefix, id), [holder, safeFence]));
    if (result[0] === 'released' || result[0] === 'stale' || result[0] === 'completed') return { status: result[0] };
    throw new Error('REDIS_SCHEDULE_LEASE_INVALID_RESPONSE:status');
  }

  return Object.freeze({ acquire, renew, complete, release });
}
