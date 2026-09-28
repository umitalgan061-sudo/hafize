import assert from 'node:assert/strict';
import { nextOccurrences } from '../lib/schedule-recurrence.ts';
const result=nextOccurrences('2026-09-28T08:30:00Z',{frequency:'weekly',interval:2,daysOfWeek:[1,5]},{now:'2026-09-28T08:31:00Z',limit:6});
assert.deepEqual(result,['2026-10-02T08:30:00.000Z','2026-10-12T08:30:00.000Z','2026-10-16T08:30:00.000Z','2026-10-26T08:30:00.000Z','2026-10-30T08:30:00.000Z','2026-11-09T08:30:00.000Z']);
console.log('weekly anchor contract: ok');
