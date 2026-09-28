import assert from 'node:assert/strict';
import { recordOccurrence, summarizeHistory } from '../lib/schedule-recurrence.ts';
let history=[];
for(let i=0;i<24;i++) history=recordOccurrence(history,{
  scheduleId:'schedule_1',status:i%3===0?'failed':'completed',attempts:1,maxAttempts:2,
  runAt:'2026-09-28T08:00:00Z',finishedAt:'2026-09-28T08:05:00Z',
  lastError:i%3===0?'SCHEDULE_EXECUTION_FAILED':null,unsafe:'drop'
});
assert.equal(history.length,20);
assert.equal(history[0].scheduleId,'schedule_1');
assert.equal('unsafe' in history[0],false);
const summary=summarizeHistory(history);
assert.equal(summary.total,20);
assert(summary.completed>0);
assert(summary.failed>0);
assert(summary.last);
console.log('scheduled recurrence history contract: ok');
