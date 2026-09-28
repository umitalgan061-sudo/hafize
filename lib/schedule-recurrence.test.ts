import { describe, expect, it } from 'vitest';
import { normalizeRecurrence, nextOccurrence, nextOccurrences, recordOccurrence, summarizeHistory, isRecurring, RECURRENCE_LIMITS } from './schedule-recurrence.ts';

const iso=(value)=>new Date(value).toISOString();

describe('schedule recurrence contract',()=>{
  it('normalizes daily recurrence with safe interval bounds',()=>{
    expect(normalizeRecurrence({frequency:'daily',interval:3})).toMatchObject({frequency:'daily',interval:3,daysOfWeek:[],dayOfMonth:null});
    expect(normalizeRecurrence({frequency:'daily',interval:999}).interval).toBe(30);
  });
  it('normalizes weekly days deterministically',()=>{
    expect(normalizeRecurrence({frequency:'weekly',interval:1,daysOfWeek:[5,1,1]}).daysOfWeek).toEqual([1,5]);
  });
  it('requires a day shape for weekly and monthly modes',()=>{
    expect(()=>normalizeRecurrence({frequency:'weekly'})).toThrow('weeklyDays');
    expect(()=>normalizeRecurrence({frequency:'monthly'})).toThrow('monthlyDay');
  });
  it('rejects unknown fields and incompatible fields',()=>{
    expect(()=>normalizeRecurrence({frequency:'daily',x:1})).toThrow('field');
    expect(()=>normalizeRecurrence({frequency:'weekly',interval:1,daysOfWeek:[1],dayOfMonth:3})).toThrow('dayOfMonth');
  });
  it('supports nullable recurrence for legacy one-shot records',()=>{
    expect(normalizeRecurrence(null)).toBeNull();
    expect(isRecurring(null)).toBe(false);
  });
  it('calculates daily occurrences from the original schedule time',()=>{
    expect(nextOccurrence('2026-09-28T08:30:00Z',{frequency:'daily',interval:1},{now:'2026-09-28T08:31:00Z'})).toBe('2026-09-29T08:30:00.000Z');
  });
  it('skips missed daily windows until a future occurrence',()=>{
    expect(nextOccurrence('2026-09-20T08:30:00Z',{frequency:'daily',interval:1},{now:'2026-09-25T08:31:00Z'})).toBe('2026-09-26T08:30:00.000Z');
  });
  it('clamps monthly runs to the last valid day',()=>{
    expect(nextOccurrence('2026-01-31T08:30:00Z',{frequency:'monthly',interval:1,dayOfMonth:31},{now:'2026-02-01T00:00:00Z'})).toBe('2026-02-28T08:30:00.000Z');
  });
  it('keeps monthly preferred day after a short month',()=>{
    expect(nextOccurrence('2026-02-28T08:30:00Z',{frequency:'monthly',interval:1,dayOfMonth:31},{now:'2026-02-28T09:00:00Z'})).toBe('2026-03-31T08:30:00.000Z');
  });
  it('calculates weekly occurrence on the next configured day',()=>{
    expect(nextOccurrence('2026-09-28T08:30:00Z',{frequency:'weekly',interval:1,daysOfWeek:[3]},{now:'2026-09-28T08:31:00Z'})).toBe('2026-09-30T08:30:00.000Z');
  });
  it('supports a two-week interval without leaking into the off week',()=>{
    const results=nextOccurrences('2026-09-28T08:30:00Z',{frequency:'weekly',interval:2,daysOfWeek:[1,5]},{now:'2026-09-28T08:31:00Z',limit:4});
    expect(results).toEqual(['2026-10-02T08:30:00.000Z','2026-10-12T08:30:00.000Z','2026-10-16T08:30:00.000Z','2026-10-26T08:30:00.000Z']);
  });
  it('supports several weekly days in the same cycle',()=>{
    const results=nextOccurrences('2026-09-28T08:30:00Z',{frequency:'weekly',interval:1,daysOfWeek:[1,5]},{now:'2026-09-28T08:31:00Z',limit:3});
    expect(results).toEqual(['2026-10-02T08:30:00.000Z','2026-10-05T08:30:00.000Z','2026-10-09T08:30:00.000Z']);
  });
  it('keeps occurrence generation bounded',()=>{
    expect(nextOccurrences('2026-09-28T08:30:00Z',{frequency:'daily',interval:1},{limit:50})).toHaveLength(50);
    expect(RECURRENCE_LIMITS.maxHistory).toBe(20);
  });
  it('records newest history first and trims to 20 entries',()=>{
    const rows=Array.from({length:25},(_,index)=>({status:index%2?'failed':'completed',attempts:1,maxAttempts:2,runAt:'2026-09-'+String((index%9)+1).padStart(2,'0')+'T08:30:00Z',finishedAt:'2026-09-'+String((index%9)+1).padStart(2,'0')+'T09:30:00Z',lastError:index%2?'X':null}));
    const trimmed=rows.reduce((acc,row)=>recordOccurrence(acc,row),[]);
    expect(trimmed).toHaveLength(20);
    expect(trimmed[0].status).toBe(rows[rows.length-1].status);
  });
  it('sanitizes occurrence fields and keeps history data compact',()=>{
    const result=recordOccurrence([],{scheduleId:'x'.repeat(999),status:'failed',attempts:999,maxAttempts:999,runAt:'2026-09-28T08:30:00Z',finishedAt:'2026-09-28T09:30:00Z',lastError:'Y'.repeat(999),secret:'must-not-persist'});
    expect(result[0]).not.toHaveProperty('secret');
    expect(result[0].scheduleId).toHaveLength(120);
    expect(result[0].attempts).toBe(999);
    expect(result[0].maxAttempts).toBe(5);
    expect(result[0].lastError).toHaveLength(120);
  });
  it('summarizes completed and failed runs',()=>{
    expect(summarizeHistory([{status:'completed'},{status:'failed'},{status:'failed'},{status:'running'}])).toEqual({total:4,completed:1,failed:2,running:1,last:{status:'completed'}});
  });
  it('rejects malformed date inputs',()=>{
    expect(()=>nextOccurrence('bad',{frequency:'daily',interval:1})).toThrow();
    expect(()=>recordOccurrence([],{runAt:'bad',finishedAt:iso('2026-09-28T00:00:00Z')})).toThrow();
  });
});
