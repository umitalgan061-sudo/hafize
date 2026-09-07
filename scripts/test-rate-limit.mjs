import assert from 'node:assert/strict';
import { createRateLimiter } from '../lib/rate-limit.mjs';

const limiter = createRateLimiter({ windowMs: 60_000, max: 2, maxConcurrent: 1, maxEntries: 10 });

const first = limiter.check('user');
assert.equal(first.ok, true);
const blockedConcurrent = limiter.check('user');
assert.equal(blockedConcurrent.ok, false);
assert.equal(blockedConcurrent.concurrent, true);
first.release();

const second = limiter.check('user');
assert.equal(second.ok, true);
second.release();
const third = limiter.check('user');
assert.equal(third.ok, false);
assert.equal(typeof third.retryAfterSeconds, 'number');

assert.equal(limiter.check('other').ok, true);
console.log('rate limit tests passed');
