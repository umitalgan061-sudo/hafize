import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit.ts';

describe('rate limiter',()=>{
  it('limits requests and reports retry seconds',()=>{
    const limiter=createRateLimiter({windowMs:1000,max:2,maxEntries:10});
    expect(limiter.check('a',0).ok).toBe(true);
    expect(limiter.check('a',10).ok).toBe(true);
    const blocked=limiter.check('a',20);
    expect(blocked.ok).toBe(false);
    if(!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
  it('rotates the quota after the window',()=>{
    const limiter=createRateLimiter({windowMs:1000,max:1,maxEntries:10});
    expect(limiter.check('a',0).ok).toBe(true);
    expect(limiter.check('a',1000).ok).toBe(true);
  });
  it('enforces concurrency and release',()=>{
    const limiter=createRateLimiter({windowMs:5000,max:10,maxConcurrent:1,maxEntries:10});
    const first=limiter.check('a',0);
    const second=limiter.check('a',1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if(first.ok) first.release();
    expect(limiter.check('a',2).ok).toBe(true);
  });
  it('bounds entry count',()=>{
    const limiter=createRateLimiter({windowMs:1000,max:3,maxEntries:2});
    limiter.check('a',0);limiter.check('b',0);limiter.check('c',0);
    expect(limiter.size()).toBeLessThanOrEqual(2);
  });
});
