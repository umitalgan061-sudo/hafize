import assert from 'node:assert/strict';
import { nextOccurrence } from '../lib/schedule-recurrence.ts';
assert.equal(nextOccurrence('2028-01-29T08:00:00Z',{frequency:'monthly',interval:1,dayOfMonth:29},{now:'2028-01-29T08:01:00Z'}),'2028-02-29T08:00:00.000Z');
assert.equal(nextOccurrence('2027-01-29T08:00:00Z',{frequency:'monthly',interval:1,dayOfMonth:29},{now:'2027-01-29T08:01:00Z'}),'2027-02-28T08:00:00.000Z');
console.log('monthly leap year contract: ok');
